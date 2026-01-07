/**
 * @ownership
 * @domain Team Collaboration
 * @description API routes for activity feed operations
 * @single-responsibility YES - handles all activity endpoints
 * @last-reviewed 2026-01-07
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { activityService } from '../services/activityService';
import { meetingAccessService } from '../services/meetingAccessService';
import { requireAuth } from '../middleware/auth';
import { AppError } from '@zigznote/shared';

export const activityRouter: RouterType = Router();

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

/**
 * GET /api/v1/activity
 * Get activity feed for the current organization
 */
activityRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, organizationId } = getAuth(req);
      const { meetingId, userId: filterUserId, action, limit, offset, before, after } = req.query;

      // If meetingId specified, check access
      if (meetingId) {
        const hasAccess = await meetingAccessService.canView(
          meetingId as string,
          userId,
          organizationId
        );

        if (!hasAccess) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      const result = await activityService.getOrganizationFeed(organizationId, {
        meetingId: meetingId as string | undefined,
        userId: filterUserId as string | undefined,
        action: action as any,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        before: before ? new Date(before as string) : undefined,
        after: after ? new Date(after as string) : undefined,
      });

      // Format activities for display
      const formattedActivities = result.activities.map((activity) => ({
        ...activity,
        formattedMessage: activityService.formatActivity(activity),
      }));

      res.json({
        success: true,
        data: formattedActivities,
        pagination: {
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/activity/summary
 * Get activity summary for dashboard
 */
activityRouter.get(
  '/summary',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = getAuth(req);
      const { hours } = req.query;

      const summary = await activityService.getRecentSummary(
        organizationId,
        hours ? parseInt(hours as string, 10) : 24
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/activity/meetings/:meetingId
 * Get activity feed for a specific meeting
 */
activityRouter.get(
  '/meetings/:meetingId',
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

      const { limit, offset } = req.query;

      const result = await activityService.getMeetingFeed(meetingId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      const formattedActivities = result.activities.map((activity) => ({
        ...activity,
        formattedMessage: activityService.formatActivity(activity),
      }));

      res.json({
        success: true,
        data: formattedActivities,
        pagination: {
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/activity/users/:userId
 * Get activity feed for a specific user
 */
activityRouter.get(
  '/users/:userId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.userId!;
      const { organizationId } = getAuth(req);
      const { limit, offset } = req.query;

      const result = await activityService.getUserFeed(targetUserId, organizationId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      const formattedActivities = result.activities.map((activity) => ({
        ...activity,
        formattedMessage: activityService.formatActivity(activity),
      }));

      res.json({
        success: true,
        data: formattedActivities,
        pagination: {
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default activityRouter;
