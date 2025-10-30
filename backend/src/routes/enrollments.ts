import express, { Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../lib/logger';

const router = express.Router();
const prisma = new PrismaClient() as any;

const createEnrollmentSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  academicYear: z.number().int().positive(),
  recursadas: z.number().int().min(0).nullable().optional(),
  attendancePct: z.number().min(0).max(100).nullable().optional(),
  dropoutFlag: z.boolean().nullable().optional(),
});

const updateEnrollmentSchema = z.object({
  recursadas: z.number().int().min(0).nullable().optional(),
  attendancePct: z.number().min(0).max(100).nullable().optional(),
  dropoutFlag: z.boolean().nullable().optional(),
});

/**
 * GET /api/enrollments
 * List enrollments with pagination and filtering
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = getPaginationParams(req);
    const subjectId = req.query.subjectId as string | undefined;
    const academicYear = req.query.academicYear
      ? parseInt(req.query.academicYear as string)
      : undefined;
    const minAttendance = req.query.minAttendance
      ? parseFloat(req.query.minAttendance as string)
      : undefined;
    const maxAttendance = req.query.maxAttendance
      ? parseFloat(req.query.maxAttendance as string)
      : undefined;
    const risk = req.query.risk as string | undefined;

    const where: any = {};

    // If user is ALUMNO, only show their enrollments
    if (req.user?.role === 'ALUMNO') {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
      });
      if (user) {
        where.studentId = user.id;
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    if (minAttendance !== undefined || maxAttendance !== undefined) {
      where.attendancePct = {};
      if (minAttendance !== undefined) {
        where.attendancePct.gte = minAttendance;
      }
      if (maxAttendance !== undefined) {
        where.attendancePct.lte = maxAttendance;
      }
    }

    if (risk === 'dropout') {
      where.dropoutFlag = true;
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          academicYear: true,
          recursadas: true,
          attendancePct: true,
          dropoutFlag: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              grades: true,
            },
          },
        },
      }),
      prisma.enrollment.count({ where }),
    ]);

    res.json(createPaginatedResponse(enrollments, page, pageSize, total));
  } catch (error) {
    logger.error('Error fetching enrollments', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/enrollments/:id
 * Get enrollment by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        academicYear: true,
        recursadas: true,
        attendancePct: true,
        dropoutFlag: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            year: true,
            kind: true,
            modality: true,
          },
        },
        grades: {
          select: {
            id: true,
            kind: true,
            grade: true,
            createdAt: true,
          },
          orderBy: {
            kind: 'asc',
          },
        },
      },
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // If user is ALUMNO, verify they can only see their own enrollment
    if (req.user?.role === 'ALUMNO') {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
      });
      if (user && enrollment.studentId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(enrollment);
  } catch (error) {
    logger.error('Error fetching enrollment', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/enrollments
 * Create new enrollment
 */
router.post('/', requireRole('DIRECTOR', 'TUTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createEnrollmentSchema.parse(req.body);

    // Verify student and subject exist
    const [student, subject] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.studentId } }),
      prisma.subject.findUnique({ where: { id: data.subjectId } }),
    ]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const enrollment = await prisma.enrollment.create({
      data,
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        academicYear: true,
        recursadas: true,
        attendancePct: true,
        dropoutFlag: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info('Enrollment created', { enrollmentId: enrollment.id });
    res.status(201).json(enrollment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({
        error: 'Enrollment already exists for this student, subject, and academic year',
      });
    }

    logger.error('Error creating enrollment', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/enrollments/:id
 * Update enrollment
 */
router.put(
  '/:id',
  requireRole('DIRECTOR', 'TUTOR', 'PROFESOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateEnrollmentSchema.parse(req.body);

      const enrollment = await prisma.enrollment.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          academicYear: true,
          recursadas: true,
          attendancePct: true,
          dropoutFlag: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info('Enrollment updated', { enrollmentId: enrollment.id });
      res.json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('Record to update does not exist')) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }

      logger.error('Error updating enrollment', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;


