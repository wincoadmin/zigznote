/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for managing in-app notifications
 * @single-responsibility YES - handles all notification operations
 * @last-reviewed 2026-01-07
 */

import { prisma, NotificationType, Prisma } from '@zigznote/database';
import type { Notification } from '@zigznote/database';
import { logger } from '../utils/logger';
import { realtimeService } from './realtimeService';

/**
 * Notification with meeting details
 */
export interface NotificationWithDetails extends Notification {
  meeting?: {
    id: string;
    title: string;
  } | null;
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  meetingId?: string;
  commentId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

/**
 * Service for notification operations
 */
export class NotificationService {
  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<{ notifications: NotificationWithDetails[]; total: number; unreadCount: number }> {
    const { read, type, limit = 50, offset = 0 } = filters;

    const where: Record<string, unknown> = { userId };

    if (read !== undefined) {
      where.read = read;
    }

    if (type) {
      where.type = type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          // We'll manually fetch meeting data since we need to handle soft-deleted meetings
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    // Fetch meeting details for notifications
    const meetingIds = [...new Set(notifications.filter(n => n.meetingId).map(n => n.meetingId!))];
    const meetings = meetingIds.length > 0
      ? await prisma.meeting.findMany({
          where: { id: { in: meetingIds } },
          select: { id: true, title: true },
        })
      : [];

    const meetingMap = new Map(meetings.map(m => [m.id, m]));

    const notificationsWithDetails: NotificationWithDetails[] = notifications.map(n => ({
      ...n,
      meeting: n.meetingId ? meetingMap.get(n.meetingId) || null : null,
    }));

    return { notifications: notificationsWithDetails, total, unreadCount };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    logger.debug({ userId: data.userId, type: data.type }, 'Creating notification');

    // Check user notification preferences
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        notifyOnMention: true,
        notifyOnReply: true,
        notifyOnShare: true,
        notifyOnComment: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      logger.debug({ userId: data.userId }, 'User not found or inactive, skipping notification');
      // Return a placeholder notification (not saved)
      return {
        id: 'skipped',
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        meetingId: data.meetingId || null,
        commentId: data.commentId || null,
        read: false,
        readAt: null,
        emailSent: false,
        metadata: data.metadata || null,
        createdAt: new Date(),
      } as Notification;
    }

    // Check if user wants this type of notification
    const shouldNotify = this.shouldNotify(data.type, user);
    if (!shouldNotify) {
      logger.debug({ userId: data.userId, type: data.type }, 'User opted out of this notification type');
      return {
        id: 'skipped',
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        meetingId: data.meetingId || null,
        commentId: data.commentId || null,
        read: false,
        readAt: null,
        emailSent: false,
        metadata: data.metadata || null,
        createdAt: new Date(),
      } as Notification;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        meetingId: data.meetingId,
        commentId: data.commentId,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // Send real-time notification
    realtimeService.sendToUser(data.userId, 'notification:new', {
      notification,
    });

    logger.info({ notificationId: notification.id, userId: data.userId }, 'Notification created');
    return notification;
  }

  /**
   * Check if user wants this notification type
   */
  private shouldNotify(
    type: NotificationType,
    preferences: {
      notifyOnMention: boolean;
      notifyOnReply: boolean;
      notifyOnShare: boolean;
      notifyOnComment: boolean;
    }
  ): boolean {
    switch (type) {
      case 'MENTION':
        return preferences.notifyOnMention;
      case 'REPLY':
        return preferences.notifyOnReply;
      case 'MEETING_SHARED':
      case 'PERMISSION_CHANGED':
        return preferences.notifyOnShare;
      case 'COMMENT_ADDED':
      case 'ANNOTATION_ADDED':
        return preferences.notifyOnComment;
      default:
        return true;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    // Send real-time update
    realtimeService.sendToUser(userId, 'notification:all-read', {});

    return result.count;
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAll(userId: string): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Clean up old notifications (older than 30 days and read)
   */
  async cleanup(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: {
        read: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    logger.info({ count: result.count }, 'Cleaned up old notifications');
    return result.count;
  }
}

export const notificationService = new NotificationService();
