/**
 * Admin analytics routes
 * Dashboard statistics and metrics
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import {
  userRepository,
  organizationRepository,
  meetingRepository,
  auditLogRepository,
} from '@zigznote/database';
import {
  requireAdminAuth,
  requireSupport,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const analyticsRouter: IRouter = Router();

// All routes require at least support role
analyticsRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const dateRangeSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    period: z.enum(['day', 'week', 'month', 'year']).default('week').optional(),
  }),
};

/**
 * @route GET /api/admin/analytics/dashboard
 * @description Get dashboard overview statistics
 */
analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Gather all stats in parallel
    const [
      totalUsers,
      totalOrgs,
      totalMeetings,
      activeUsers,
    ] = await Promise.all([
      userRepository.count(),
      organizationRepository.count(),
      meetingRepository.count(),
      userRepository.count(), // Would be filtered by recent activity
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalOrganizations: totalOrgs,
          totalMeetings,
          activeUsers,
        },
        period: {
          start: thirtyDaysAgo.toISOString(),
          end: now.toISOString(),
        },
      },
    });
  })
);

/**
 * @route GET /api/admin/analytics/users
 * @description Get user analytics
 */
analyticsRouter.get(
  '/users',
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, period: _period } = req.query as z.infer<typeof dateRangeSchema['query']>;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get user counts
    const [total, active, suspended] = await Promise.all([
      userRepository.count(),
      userRepository.count({ includeDeleted: false }),
      userRepository.count({ includeDeleted: true }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        suspended: suspended - active,
        period: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  })
);

/**
 * @route GET /api/admin/analytics/organizations
 * @description Get organization analytics
 */
analyticsRouter.get(
  '/organizations',
  validateRequest(dateRangeSchema),
  asyncHandler(async (_req: Request, res: Response) => {
    const allOrgs = await organizationRepository.findMany({ includeDeleted: true });

    const stats = {
      total: allOrgs.length,
      active: 0,
      suspended: 0,
      byPlan: {} as Record<string, number>,
      byAccountType: {} as Record<string, number>,
    };

    for (const org of allOrgs) {
      if (org.deletedAt) {
        stats.suspended++;
      } else {
        stats.active++;
      }

      stats.byPlan[org.plan] = (stats.byPlan[org.plan] || 0) + 1;
      stats.byAccountType[org.accountType] = (stats.byAccountType[org.accountType] || 0) + 1;
    }

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/analytics/meetings
 * @description Get meeting analytics
 */
analyticsRouter.get(
  '/meetings',
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as z.infer<typeof dateRangeSchema['query']>;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get meeting stats
    const allMeetings = await meetingRepository.findMany({});

    const stats = {
      total: allMeetings.length,
      byStatus: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      inDateRange: 0,
    };

    for (const meeting of allMeetings) {
      stats.byStatus[meeting.status] = (stats.byStatus[meeting.status] || 0) + 1;
      if (meeting.platform) {
        stats.byPlatform[meeting.platform] = (stats.byPlatform[meeting.platform] || 0) + 1;
      }

      if (meeting.createdAt >= start && meeting.createdAt <= end) {
        stats.inDateRange++;
      }
    }

    res.json({
      success: true,
      data: {
        ...stats,
        period: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  })
);

/**
 * @route GET /api/admin/analytics/activity
 * @description Get recent admin activity
 */
analyticsRouter.get(
  '/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const recentLogs = await auditLogRepository.findManyPaginated(
      { page: 1, limit },
      {},
      { createdAt: 'desc' },
      { adminUser: { select: { id: true, name: true, email: true } } }
    );

    res.json({
      success: true,
      data: recentLogs.data,
      pagination: recentLogs.pagination,
    });
  })
);

/**
 * @route GET /api/admin/analytics/growth
 * @description Get growth metrics
 */
analyticsRouter.get(
  '/growth',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const periods = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      thisWeek: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      thisMonth: new Date(now.getFullYear(), now.getMonth(), 1),
      lastMonth: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    };

    // Get all users and orgs for counting
    const [allUsers, allOrgs] = await Promise.all([
      userRepository.findMany({ includeDeleted: false }),
      organizationRepository.findMany({ includeDeleted: false }),
    ]);

    const growth = {
      users: {
        today: allUsers.filter((u) => u.createdAt >= periods.today).length,
        thisWeek: allUsers.filter((u) => u.createdAt >= periods.thisWeek).length,
        thisMonth: allUsers.filter((u) => u.createdAt >= periods.thisMonth).length,
        total: allUsers.length,
      },
      organizations: {
        today: allOrgs.filter((o) => o.createdAt >= periods.today).length,
        thisWeek: allOrgs.filter((o) => o.createdAt >= periods.thisWeek).length,
        thisMonth: allOrgs.filter((o) => o.createdAt >= periods.thisMonth).length,
        total: allOrgs.length,
      },
    };

    res.json({
      success: true,
      data: growth,
    });
  })
);
