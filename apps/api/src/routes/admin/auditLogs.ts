/**
 * Admin audit log routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { auditService } from '../../services/auditService';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const auditLogsRouter: IRouter = Router();

// All routes require at least support role
auditLogsRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    adminUserId: z.string().uuid().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

const entityHistorySchema = z.object({
  params: z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  }),
});

const exportSchema = z.object({
  query: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    adminUserId: z.string().uuid().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
  }),
});

/**
 * @route GET /api/admin/audit-logs
 * @description List audit logs with pagination
 */
auditLogsRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, adminUserId, action, entityType, entityId, startDate, endDate } =
      req.query as z.infer<typeof listSchema>['query'];

    const result = await auditService.getLogs(
      { page, limit },
      {
        adminUserId: adminUserId as string | undefined,
        action: action as string | undefined,
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      }
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

/**
 * @route GET /api/admin/audit-logs/:id
 * @description Get a single audit log entry
 */
auditLogsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const logs = await auditService.getLogs({ page: 1, limit: 1 }, {});
    const log = logs.data.find((l) => l.id === id);

    if (!log) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Audit log not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: log,
    });
  })
);

/**
 * @route GET /api/admin/audit-logs/entity/:entityType/:entityId
 * @description Get audit history for a specific entity
 */
auditLogsRouter.get(
  '/entity/:entityType/:entityId',
  validateRequest(entityHistorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;
    const { limit } = req.query as z.infer<typeof entityHistorySchema>['query'];

    const logs = await auditService.getEntityHistory(entityType, entityId, limit);

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * @route GET /api/admin/audit-logs/admin/:adminId
 * @description Get recent activity for a specific admin
 */
auditLogsRouter.get(
  '/admin/:adminId',
  asyncHandler(async (req: Request, res: Response) => {
    const { adminId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await auditService.getAdminActivity(adminId, limit);

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * @route GET /api/admin/audit-logs/stats
 * @description Get action statistics
 */
auditLogsRouter.get(
  '/stats/actions',
  asyncHandler(async (req: Request, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await auditService.getActionStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/audit-logs/export
 * @description Export audit logs for a date range (admin only)
 */
auditLogsRouter.get(
  '/export',
  requireAdminRoleLevel,
  validateRequest(exportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { startDate, endDate, adminUserId, action, entityType } =
      req.query as z.infer<typeof exportSchema>['query'];

    const logs = await auditService.exportLogs(
      new Date(startDate),
      new Date(endDate),
      {
        adminUserId: adminUserId as string | undefined,
        action: action as string | undefined,
        entityType: entityType as string | undefined,
      }
    );

    // Log the export action
    await auditService.log(
      {
        adminId: adminReq.adminAuth?.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'audit_logs.exported',
        entityType: 'audit_log',
        details: { startDate, endDate, count: logs.length },
      }
    );

    res.json({
      success: true,
      data: logs,
      meta: {
        exportedAt: new Date().toISOString(),
        count: logs.length,
        dateRange: { startDate, endDate },
      },
    });
  })
);
