/**
 * @ownership
 * @domain Team Collaboration
 * @description API routes for notification operations
 * @single-responsibility YES - handles all notification endpoints
 * @last-reviewed 2026-01-07
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { notificationService } from '../services/notificationService';
import { requireAuth } from '../middleware/auth';
import { AppError } from '@zigznote/shared';

export const notificationsRouter: RouterType = Router();

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
 * GET /api/v1/notifications
 * Get notifications for the current user
 */
notificationsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      const { read, type, limit, offset } = req.query;

      const result = await notificationService.getNotifications(userId, {
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        type: type as any,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: result.notifications,
        pagination: {
          total: result.total,
          unreadCount: result.unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 */
notificationsRouter.get(
  '/unread-count',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/notifications/:notificationId/read
 * Mark a notification as read
 */
notificationsRouter.post(
  '/:notificationId/read',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = req.params.notificationId!;
      const { userId } = getAuth(req);

      const notification = await notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/notifications/mark-all-read
 * Mark all notifications as read
 */
notificationsRouter.post(
  '/mark-all-read',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      const count = await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: { markedCount: count },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/notifications/:notificationId
 * Delete a notification
 */
notificationsRouter.delete(
  '/:notificationId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = req.params.notificationId!;
      const { userId } = getAuth(req);

      await notificationService.delete(notificationId, userId);

      res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/notifications
 * Delete all notifications
 */
notificationsRouter.delete(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      const count = await notificationService.deleteAll(userId);

      res.json({
        success: true,
        data: { deletedCount: count },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default notificationsRouter;
