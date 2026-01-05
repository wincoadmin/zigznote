/**
 * Analytics routes
 * Endpoints for user and organization analytics
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { analyticsService } from '../services';
import {
  requireAuth,
  asyncHandler,
  type AuthenticatedRequest,
} from '../middleware';

export const analyticsRouter: IRouter = Router();

// All analytics routes require authentication
analyticsRouter.use(requireAuth);

/**
 * @route GET /api/v1/analytics/dashboard
 * @description Get user dashboard statistics
 */
analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const stats = await analyticsService.getUserDashboardStats(
      authReq.auth!.userId,
      authReq.auth!.organizationId
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/v1/analytics/productivity
 * @description Get user productivity score
 */
analyticsRouter.get(
  '/productivity',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const score = await analyticsService.getProductivityScore(
      authReq.auth!.userId,
      authReq.auth!.organizationId
    );

    res.json({
      success: true,
      data: score,
    });
  })
);

/**
 * @route GET /api/v1/analytics/achievements
 * @description Get user achievements with progress
 */
analyticsRouter.get(
  '/achievements',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const achievements = await analyticsService.getUserAchievements(
      authReq.auth!.userId
    );

    res.json({
      success: true,
      data: achievements,
    });
  })
);

/**
 * @route POST /api/v1/analytics/achievements/check
 * @description Check and unlock any new achievements
 */
analyticsRouter.post(
  '/achievements/check',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const newlyUnlocked = await analyticsService.checkAndUnlockAchievements(
      authReq.auth!.userId,
      authReq.auth!.organizationId
    );

    res.json({
      success: true,
      data: {
        newlyUnlocked,
        count: newlyUnlocked.length,
      },
    });
  })
);

/**
 * @route GET /api/v1/analytics/organization
 * @description Get organization analytics (admin only)
 */
analyticsRouter.get(
  '/organization',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const stats = await analyticsService.getOrgAnalyticsStats(
      authReq.auth!.organizationId
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route POST /api/v1/analytics/track/:metric
 * @description Track a user metric
 */
analyticsRouter.post(
  '/track/:metric',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { metric } = req.params;
    const { increment } = req.body;

    const allowedMetrics = [
      'summariesViewed',
      'transcriptsViewed',
      'searchesPerformed',
    ];

    if (!allowedMetrics.includes(metric!)) {
      return res.status(400).json({
        success: false,
        error: `Invalid metric. Allowed: ${allowedMetrics.join(', ')}`,
      });
    }

    await analyticsService.recordUserDailyMetric(
      authReq.auth!.userId,
      authReq.auth!.organizationId,
      metric! as any,
      increment || 1
    );

    return res.json({
      success: true,
      message: 'Metric recorded',
    });
  })
);

/**
 * @route GET /api/v1/analytics/digest/preview
 * @description Preview weekly digest data
 */
analyticsRouter.get(
  '/digest/preview',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const digestData = await analyticsService.getWeeklyDigestData(
      authReq.auth!.userId
    );

    res.json({
      success: true,
      data: digestData,
    });
  })
);
