import express, { Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../lib/logger';

const router = express.Router();
const prisma = new PrismaClient() as any;

const createSubjectSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().positive().nullable().optional(),
  kind: z.string().nullable().optional(),
  modality: z.string().nullable().optional(),
  hasTutor: z.boolean().nullable().optional(),
});

const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  year: z.number().int().positive().nullable().optional(),
  kind: z.string().nullable().optional(),
  modality: z.string().nullable().optional(),
  hasTutor: z.boolean().nullable().optional(),
});

/**
 * GET /api/subjects
 * List subjects with pagination and filtering
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = getPaginationParams(req);
    const nameFilter = req.query.name as string | undefined;

    const where: any = {};
    if (nameFilter) {
      where.name = {
        contains: nameFilter,
        mode: 'insensitive',
      };
    }

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          year: true,
          kind: true,
          modality: true,
          hasTutor: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.subject.count({ where }),
    ]);

    res.json(createPaginatedResponse(subjects, page, pageSize, total));
  } catch (error) {
    logger.error('Error fetching subjects', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subjects/:id
 * Get subject by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        year: true,
        kind: true,
        modality: true,
        hasTutor: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    res.json(subject);
  } catch (error) {
    logger.error('Error fetching subject', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/subjects
 * Create new subject (DIRECTOR, TUTOR)
 */
router.post(
  '/',
  requireRole('DIRECTOR', 'TUTOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createSubjectSchema.parse(req.body);

      const subject = await prisma.subject.create({
        data,
        select: {
          id: true,
          name: true,
          year: true,
          kind: true,
          modality: true,
          hasTutor: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('Subject created', { subjectId: subject.id, name: subject.name });
      res.status(201).json(subject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return res.status(409).json({ error: 'Subject with this name already exists' });
      }

      logger.error('Error creating subject', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/subjects/:id
 * Update subject (DIRECTOR, TUTOR)
 */
router.put(
  '/:id',
  requireRole('DIRECTOR', 'TUTOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateSubjectSchema.parse(req.body);

      const subject = await prisma.subject.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          name: true,
          year: true,
          kind: true,
          modality: true,
          hasTutor: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('Subject updated', { subjectId: subject.id });
      res.json(subject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('Record to update does not exist')) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return res.status(409).json({ error: 'Subject with this name already exists' });
      }

      logger.error('Error updating subject', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/subjects/:id
 * Delete subject (DIRECTOR only)
 */
router.delete(
  '/:id',
  requireRole('DIRECTOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.subject.delete({
        where: { id: req.params.id },
      });

      logger.info('Subject deleted', { subjectId: req.params.id });
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      logger.error('Error deleting subject', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;


