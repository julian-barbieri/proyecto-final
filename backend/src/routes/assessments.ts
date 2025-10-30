import express, { Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Temporary fix until Prisma client is properly generated
const AssessmentType = {
  PARCIAL1: 'PARCIAL1',
  PARCIAL2: 'PARCIAL2', 
  RECUP1: 'RECUP1',
  RECUP2: 'RECUP2',
  FINAL1: 'FINAL1',
  FINAL2: 'FINAL2',
  FINAL3: 'FINAL3',
} as const;
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../lib/logger';

const router = express.Router();
const prisma = new PrismaClient() as any;

const assessmentTypeEnum = z.nativeEnum(AssessmentType);

const createAssessmentSchema = z.object({
  enrollmentId: z.string().min(1),
  kind: assessmentTypeEnum,
  grade: z.number().int().min(1).max(10).nullable().optional(),
});

const updateAssessmentSchema = z.object({
  grade: z.number().int().min(1).max(10).nullable().optional(),
});

/**
 * GET /api/assessments
 * List assessments with filtering
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = getPaginationParams(req);
    const enrollmentId = req.query.enrollmentId as string | undefined;
    const kind = req.query.kind as string | undefined;

    const where: any = {};

    if (enrollmentId) {
      where.enrollmentId = enrollmentId;
    }

    if (kind) {
      try {
        where.kind = assessmentTypeEnum.parse(kind);
      } catch {
        return res.status(400).json({ error: 'Invalid assessment type' });
      }
    }

    // If user is ALUMNO, filter by their enrollments
    if (req.user?.role === 'ALUMNO') {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
      });
      if (user) {
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: user.id },
          select: { id: true },
        });
        where.enrollmentId = {
          in: enrollments.map((e: { id: string }) => e.id),
        };
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          enrollmentId: true,
          kind: true,
          grade: true,
          createdAt: true,
          enrollment: {
            select: {
              id: true,
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
          },
        },
      }),
      prisma.assessment.count({ where }),
    ]);

    res.json(createPaginatedResponse(assessments, page, pageSize, total));
  } catch (error) {
    logger.error('Error fetching assessments', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/assessments/:id
 * Get assessment by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        enrollmentId: true,
        kind: true,
        grade: true,
        createdAt: true,
        enrollment: {
          select: {
            id: true,
            academicYear: true,
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
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // If user is ALUMNO, verify they can only see their own assessment
    if (req.user?.role === 'ALUMNO') {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
      });
      if (user && assessment.enrollment.student.id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(assessment);
  } catch (error) {
    logger.error('Error fetching assessment', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/assessments
 * Create new assessment
 */
router.post('/', requireRole('DIRECTOR', 'TUTOR', 'PROFESOR'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createAssessmentSchema.parse(req.body);

    // Validate grade range
    if (data.grade !== null && data.grade !== undefined && (Number(data.grade) < 1 || Number(data.grade) > 10)) {
      return res.status(400).json({ error: 'Grade must be between 1 and 10' });
    }

    // Verify enrollment exists
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const assessment = await prisma.assessment.create({
      data,
      select: {
        id: true,
        enrollmentId: true,
        kind: true,
        grade: true,
        createdAt: true,
        enrollment: {
          select: {
            id: true,
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
        },
      },
    });

    logger.info('Assessment created', { assessmentId: assessment.id });
    res.status(201).json(assessment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({
        error: 'Assessment already exists for this enrollment and kind',
      });
    }

    logger.error('Error creating assessment', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/assessments/:id
 * Update assessment
 */
router.put(
  '/:id',
  requireRole('DIRECTOR', 'TUTOR', 'PROFESOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateAssessmentSchema.parse(req.body);

      // Validate grade range
      if (data.grade !== null && data.grade !== undefined && (Number(data.grade) < 1 || Number(data.grade) > 10)) {
        return res.status(400).json({ error: 'Grade must be between 1 and 10' });
      }

      const assessment = await prisma.assessment.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          enrollmentId: true,
          kind: true,
          grade: true,
          createdAt: true,
          enrollment: {
            select: {
              id: true,
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
          },
        },
      });

      logger.info('Assessment updated', { assessmentId: assessment.id });
      res.json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('Record to update does not exist')) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      logger.error('Error updating assessment', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;


