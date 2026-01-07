/**
 * @ownership
 * @domain Team Collaboration
 * @description API routes for annotation operations
 * @single-responsibility YES - handles all annotation endpoints
 * @last-reviewed 2026-01-07
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { annotationService } from '../services/annotationService';
import { meetingAccessService } from '../services/meetingAccessService';
import { requireAuth } from '../middleware/auth';
import { AppError } from '@zigznote/shared';

export const annotationsRouter: RouterType = Router();

// Helper to extract auth from request
function getAuth(req: Request): { userId: string; organizationId: string } {
  const auth = (req as any).auth;
  const userId = auth?.userId as string | undefined;
  const organizationId = (auth?.organizationId || '') as string;

  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return { userId, organizationId };
}

// Valid annotation labels
const annotationLabels = [
  'HIGHLIGHT',
  'ACTION_ITEM',
  'DECISION',
  'QUESTION',
  'IMPORTANT',
  'FOLLOW_UP',
  'BLOCKER',
  'IDEA',
] as const;

// Validation schemas
const createAnnotationSchema = z.object({
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  segmentIds: z.array(z.string()),
  text: z.string().max(5000).optional(),
  label: z.enum(annotationLabels).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateAnnotationSchema = z.object({
  text: z.string().max(5000).optional(),
  label: z.enum(annotationLabels).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

/**
 * GET /api/v1/meetings/:meetingId/annotations
 * Get all annotations for a meeting
 */
annotationsRouter.get(
  '/meetings/:meetingId/annotations',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { label, userId: filterUserId } = req.query;
      const { userId, organizationId } = getAuth(req);

      // Check access
      const hasAccess = await meetingAccessService.canView(meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const annotations = await annotationService.getAnnotations(meetingId, {
        label: label as typeof annotationLabels[number] | undefined,
        userId: filterUserId as string | undefined,
      });

      res.json({
        success: true,
        data: annotations,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meetings/:meetingId/annotations/range
 * Get annotations in a time range
 */
annotationsRouter.get(
  '/meetings/:meetingId/annotations/range',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { startTime, endTime } = req.query;
      const { userId, organizationId } = getAuth(req);

      if (!startTime || !endTime) {
        throw new AppError('startTime and endTime are required', 400, 'VALIDATION_ERROR');
      }

      // Check access
      const hasAccess = await meetingAccessService.canView(meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const annotations = await annotationService.getAnnotationsInRange(
        meetingId,
        parseFloat(startTime as string),
        parseFloat(endTime as string)
      );

      res.json({
        success: true,
        data: annotations,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meetings/:meetingId/annotations/stats
 * Get annotation statistics for a meeting
 */
annotationsRouter.get(
  '/meetings/:meetingId/annotations/stats',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { userId, organizationId } = getAuth(req);

      // Check access
      const hasAccess = await meetingAccessService.canView(meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const stats = await annotationService.getStats(meetingId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/annotations/labels
 * Get available annotation labels
 */
annotationsRouter.get(
  '/annotations/labels',
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const labels = annotationService.getLabels();

      res.json({
        success: true,
        data: labels,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/annotations/:annotationId
 * Get a single annotation
 */
annotationsRouter.get(
  '/annotations/:annotationId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const annotationId = req.params.annotationId!;
      const { userId, organizationId } = getAuth(req);

      const annotation = await annotationService.getById(annotationId);
      if (!annotation) {
        throw new AppError('Annotation not found', 404, 'NOT_FOUND');
      }

      // Check access to the meeting
      const hasAccess = await meetingAccessService.canView(annotation.meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      res.json({
        success: true,
        data: annotation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meetings/:meetingId/annotations
 * Create a new annotation
 */
annotationsRouter.post(
  '/meetings/:meetingId/annotations',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { userId, organizationId } = getAuth(req);

      // Check edit permission (annotations require EDITOR level)
      const canEdit = await meetingAccessService.canEdit(meetingId, userId, organizationId);
      if (!canEdit) {
        throw new AppError('You do not have permission to annotate this meeting', 403, 'FORBIDDEN');
      }

      const validationResult = createAnnotationSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      const annotation = await annotationService.create({
        meetingId,
        userId,
        ...validationResult.data,
      });

      res.status(201).json({
        success: true,
        data: annotation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/annotations/:annotationId
 * Update an annotation
 */
annotationsRouter.patch(
  '/annotations/:annotationId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const annotationId = req.params.annotationId!;
      const { userId } = getAuth(req);

      const validationResult = updateAnnotationSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      const annotation = await annotationService.update(annotationId, userId, validationResult.data);

      res.json({
        success: true,
        data: annotation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/annotations/:annotationId
 * Delete an annotation
 */
annotationsRouter.delete(
  '/annotations/:annotationId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const annotationId = req.params.annotationId!;
      const { userId } = getAuth(req);

      await annotationService.delete(annotationId, userId);

      res.json({
        success: true,
        message: 'Annotation deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default annotationsRouter;
