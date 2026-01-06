/**
 * @ownership
 * @domain GDPR Data Export
 * @description API routes for user data export requests for GDPR compliance
 * @single-responsibility YES — handles all GDPR data export operations
 * @last-reviewed 2026-01-06
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { AppError } from '@zigznote/shared';
import { Queue } from 'bullmq';

export const dataExportRouter: RouterType = Router();

// Validation schemas
const createExportSchema = z.object({
  includeAudio: z.boolean().default(false),
});

// Queue for processing exports (will be processed by worker)
let exportQueue: Queue | null = null;
try {
  if (process.env.REDIS_URL) {
    exportQueue = new Queue('data-export', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });
  }
} catch (_err) {
  // Queue not available in test environment
}

/**
 * GET /api/v1/data-export
 * List user's data export requests
 */
dataExportRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const exports = await prisma.dataExport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      res.json({
        success: true,
        data: exports.map((exp) => ({
          id: exp.id,
          status: exp.status,
          includeAudio: exp.includeAudio,
          downloadUrl: exp.status === 'completed' ? exp.downloadUrl : null,
          expiresAt: exp.expiresAt,
          sizeBytes: exp.sizeBytes,
          errorMessage: exp.status === 'failed' ? exp.errorMessage : null,
          createdAt: exp.createdAt,
          completedAt: exp.completedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/data-export
 * Request a new data export
 */
dataExportRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const validationResult = createExportSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check for pending exports (rate limit: one pending export at a time)
      const pendingExport = await prisma.dataExport.findFirst({
        where: {
          userId: user.id,
          status: { in: ['pending', 'processing'] },
        },
      });

      if (pendingExport) {
        throw new AppError('You already have a pending data export request', 429, 'RATE_LIMIT');
      }

      // Create export request
      const dataExport = await prisma.dataExport.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          includeAudio: validationResult.data.includeAudio,
          status: 'pending',
        },
      });

      // Queue the export job
      if (exportQueue) {
        await exportQueue.add('process-export', {
          exportId: dataExport.id,
          userId: user.id,
          organizationId: user.organizationId,
          includeAudio: validationResult.data.includeAudio,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          id: dataExport.id,
          status: dataExport.status,
          includeAudio: dataExport.includeAudio,
          createdAt: dataExport.createdAt,
        },
        message: 'Data export request submitted. You will receive an email when it is ready.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/data-export/:exportId
 * Get status of a specific export
 */
dataExportRouter.get(
  '/:exportId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { exportId } = req.params;

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const dataExport = await prisma.dataExport.findFirst({
        where: {
          id: exportId,
          userId: user.id,
        },
      });

      if (!dataExport) {
        throw new AppError('Export not found', 404, 'EXPORT_NOT_FOUND');
      }

      // Check if download link has expired
      let isExpired = false;
      if (dataExport.expiresAt && new Date() > dataExport.expiresAt) {
        isExpired = true;
      }

      res.json({
        success: true,
        data: {
          id: dataExport.id,
          status: isExpired ? 'expired' : dataExport.status,
          includeAudio: dataExport.includeAudio,
          downloadUrl: dataExport.status === 'completed' && !isExpired ? dataExport.downloadUrl : null,
          expiresAt: dataExport.expiresAt,
          sizeBytes: dataExport.sizeBytes,
          errorMessage: dataExport.status === 'failed' ? dataExport.errorMessage : null,
          createdAt: dataExport.createdAt,
          completedAt: dataExport.completedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default dataExportRouter;
