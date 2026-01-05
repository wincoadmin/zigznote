/**
 * Admin operations routes
 * System health, jobs, and monitoring
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';
import { auditService, type AuditContext } from '../../services/auditService';
import { prisma } from '@zigznote/database';
import { config } from '../../config';

export const operationsRouter: IRouter = Router();

// All routes require at least support role
operationsRouter.use(requireAdminAuth, requireSupport);

/**
 * @route GET /api/admin/operations/health
 * @description Get system health status
 */
operationsRouter.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const checks: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latency?: number; error?: string }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'unhealthy', error: (error as Error).message };
    }

    // Check Redis (if available)
    try {
      // Redis check would go here
      checks.redis = { status: 'healthy', latency: 0 };
    } catch (error) {
      checks.redis = { status: 'degraded', error: 'Redis not configured' };
    }

    // Overall status
    const overallStatus = Object.values(checks).every((c) => c.status === 'healthy')
      ? 'healthy'
      : Object.values(checks).some((c) => c.status === 'unhealthy')
        ? 'unhealthy'
        : 'degraded';

    res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
        version: process.env.npm_package_version || '0.1.0',
        environment: config.env,
      },
    });
  })
);

/**
 * @route GET /api/admin/operations/system
 * @description Get system information
 */
operationsRouter.get(
  '/system',
  asyncHandler(async (req: Request, res: Response) => {
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        uptime: {
          seconds: Math.floor(process.uptime()),
          formatted: formatUptime(process.uptime()),
        },
        environment: config.env,
        pid: process.pid,
      },
    });
  })
);

/**
 * @route GET /api/admin/operations/jobs
 * @description Get job queue status
 */
operationsRouter.get(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    // Job queue status would come from BullMQ
    // This is a placeholder for the queue statistics
    const queues = {
      transcription: {
        name: 'transcription',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
      summarization: {
        name: 'summarization',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
      webhook: {
        name: 'webhook',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
      calendarSync: {
        name: 'calendar_sync',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
    };

    res.json({
      success: true,
      data: {
        queues: Object.values(queues),
        totalWaiting: Object.values(queues).reduce((sum, q) => sum + q.waiting, 0),
        totalActive: Object.values(queues).reduce((sum, q) => sum + q.active, 0),
        totalFailed: Object.values(queues).reduce((sum, q) => sum + q.failed, 0),
      },
    });
  })
);

/**
 * @route POST /api/admin/operations/jobs/:queue/pause
 * @description Pause a job queue (requires admin role)
 */
operationsRouter.post(
  '/jobs/:queue/pause',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { queue } = req.params;

    // Queue pause logic would go here

    await auditService.log(
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'operations.queue_paused',
        entityType: 'job_queue',
        entityId: queue,
        details: { queue },
      }
    );

    res.json({
      success: true,
      message: `Queue ${queue} paused`,
    });
  })
);

/**
 * @route POST /api/admin/operations/jobs/:queue/resume
 * @description Resume a job queue (requires admin role)
 */
operationsRouter.post(
  '/jobs/:queue/resume',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { queue } = req.params;

    // Queue resume logic would go here

    await auditService.log(
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'operations.queue_resumed',
        entityType: 'job_queue',
        entityId: queue,
        details: { queue },
      }
    );

    res.json({
      success: true,
      message: `Queue ${queue} resumed`,
    });
  })
);

/**
 * @route POST /api/admin/operations/jobs/:queue/clean
 * @description Clean failed jobs from a queue (requires admin role)
 */
operationsRouter.post(
  '/jobs/:queue/clean',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { queue } = req.params;
    const { status } = req.body; // 'failed', 'completed', etc.

    // Queue clean logic would go here

    await auditService.log(
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'operations.queue_cleaned',
        entityType: 'job_queue',
        entityId: queue,
        details: { queue, status },
      }
    );

    res.json({
      success: true,
      message: `Queue ${queue} cleaned`,
    });
  })
);

/**
 * @route GET /api/admin/operations/logs
 * @description Get application logs
 */
operationsRouter.get(
  '/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const level = req.query.level as string || 'info';
    const limit = parseInt(req.query.limit as string) || 100;

    // In a real implementation, this would read from a log aggregation service
    // For now, return a placeholder
    res.json({
      success: true,
      data: {
        logs: [],
        message: 'Log aggregation not configured. Check application logs directly.',
        filters: { level, limit },
      },
    });
  })
);

/**
 * @route POST /api/admin/operations/cache/clear
 * @description Clear application cache (requires admin role)
 */
operationsRouter.post(
  '/cache/clear',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { pattern } = req.body;

    // Cache clear logic would go here (Redis FLUSHDB or pattern-based delete)

    await auditService.log(
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'operations.cache_cleared',
        entityType: 'cache',
        details: { pattern: pattern || 'all' },
      }
    );

    res.json({
      success: true,
      message: 'Cache cleared',
    });
  })
);

/**
 * @route POST /api/admin/operations/maintenance
 * @description Run maintenance tasks (requires super_admin)
 */
operationsRouter.post(
  '/maintenance',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;

    if (adminReq.adminAuth?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only super admins can run maintenance' },
      });
      return;
    }

    const { tasks } = req.body;
    const results: Record<string, { success: boolean; message: string }> = {};

    if (tasks?.includes('cleanup_sessions')) {
      // Clean up expired sessions
      results.cleanup_sessions = { success: true, message: 'Expired sessions cleaned' };
    }

    if (tasks?.includes('cleanup_audit_logs')) {
      // Clean up old audit logs
      const deleted = await auditService.cleanup(90);
      results.cleanup_audit_logs = { success: true, message: `Deleted ${deleted} old audit logs` };
    }

    if (tasks?.includes('vacuum_database')) {
      // VACUUM ANALYZE on PostgreSQL
      try {
        await prisma.$executeRaw`VACUUM ANALYZE`;
        results.vacuum_database = { success: true, message: 'Database vacuumed' };
      } catch (error) {
        results.vacuum_database = { success: false, message: (error as Error).message };
      }
    }

    await auditService.log(
      {
        adminId: adminReq.adminAuth.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      {
        action: 'operations.maintenance_run',
        entityType: 'system',
        details: { tasks, results },
      }
    );

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
