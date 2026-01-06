/**
 * @ownership
 * @domain Admin Backup Management
 * @description API routes for database backup operations
 * @single-responsibility YES — handles all admin backup operations
 * @last-reviewed 2026-01-06
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { backupService } from '../../services/backupService';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth, AdminAuthenticatedRequest } from '../../middleware/adminAuth';
import { auditService } from '../../services/auditService';

const router: Router = Router();

// All routes require admin auth
router.use(requireAdminAuth);

// Schema for creating backup
const createBackupSchema = {
  body: z.object({
    type: z.enum(['FULL', 'MANUAL', 'PRE_MIGRATION']).default('MANUAL'),
  }),
};

/**
 * POST /admin/backups - Create a new backup
 */
router.post(
  '/',
  validateRequest(createBackupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { type } = req.body;

    const result = await backupService.createBackup(type, adminReq.adminAuth?.adminId);

    await auditService.log(
      {
        adminId: adminReq.adminAuth?.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
      },
      {
        action: 'backup.create',
        entityType: 'database_backup',
        entityId: result.id,
        details: { type, size: result.size, filename: result.filename },
      }
    );

    res.status(201).json({
      message: 'Backup created successfully',
      backup: result,
    });
  })
);

// Schema for listing backups
const listBackupsSchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    type: z.enum(['FULL', 'INCREMENTAL', 'SCHEDULED', 'MANUAL', 'PRE_MIGRATION']).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'DELETED']).optional(),
  }),
};

/**
 * GET /admin/backups - List all backups
 */
router.get(
  '/',
  validateRequest(listBackupsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, type, status } = req.query as {
      page?: number;
      limit?: number;
      type?: 'FULL' | 'INCREMENTAL' | 'SCHEDULED' | 'MANUAL' | 'PRE_MIGRATION';
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'DELETED';
    };

    const result = await backupService.listBackups({ page, limit, type, status });
    res.json(result);
  })
);

/**
 * GET /admin/backups/latest - Get latest successful backup
 */
router.get(
  '/latest',
  asyncHandler(async (_req: Request, res: Response) => {
    const backup = await backupService.getLatestBackup();

    if (!backup) {
      res.status(404).json({ message: 'No successful backups found' });
      return;
    }

    res.json({ backup });
  })
);

/**
 * POST /admin/backups/:id/verify - Verify backup integrity
 */
router.post(
  '/:id/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const backupId = req.params.id;
    if (!backupId) {
      res.status(400).json({ message: 'Backup ID required' });
      return;
    }
    const result = await backupService.verifyBackup(backupId);
    res.json(result);
  })
);

// Schema for restoring backup
const restoreSchema = {
  body: z.object({
    dryRun: z.boolean().default(true),
    confirmRestore: z.literal(true),
  }),
};

/**
 * POST /admin/backups/:id/restore - Restore from backup
 */
router.post(
  '/:id/restore',
  validateRequest(restoreSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { dryRun } = req.body;
    const backupId = req.params.id;

    if (!backupId) {
      res.status(400).json({ message: 'Backup ID required' });
      return;
    }

    await auditService.log(
      {
        adminId: adminReq.adminAuth?.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
      },
      {
        action: 'backup.restore',
        entityType: 'database_backup',
        entityId: backupId,
        details: { dryRun },
      }
    );

    await backupService.restoreBackup(backupId, dryRun);

    res.json({
      message: dryRun ? 'Dry run completed - backup verified' : 'Database restored successfully',
    });
  })
);

/**
 * DELETE /admin/backups/:id - Delete a backup
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const backupId = req.params.id;

    if (!backupId) {
      res.status(400).json({ message: 'Backup ID required' });
      return;
    }

    await backupService.deleteBackup(backupId);

    await auditService.log(
      {
        adminId: adminReq.adminAuth?.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
      },
      {
        action: 'backup.delete',
        entityType: 'database_backup',
        entityId: backupId,
      }
    );

    res.json({ message: 'Backup deleted successfully' });
  })
);

/**
 * POST /admin/backups/cleanup - Cleanup expired backups
 */
router.post(
  '/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;

    const deletedCount = await backupService.cleanupExpiredBackups();

    await auditService.log(
      {
        adminId: adminReq.adminAuth?.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
      },
      {
        action: 'backup.cleanup',
        entityType: 'database_backup',
        details: { deletedCount },
      }
    );

    res.json({
      message: `Cleaned up ${deletedCount} expired backups`,
      deletedCount,
    });
  })
);

export default router;
