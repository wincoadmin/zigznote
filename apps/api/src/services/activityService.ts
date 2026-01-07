/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for logging and retrieving activity feed events
 * @single-responsibility YES - handles all activity logging operations
 * @last-reviewed 2026-01-07
 */

import { prisma, ActivityAction, Prisma } from '@zigznote/database';
import type { Activity } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Activity with user and meeting details
 */
export interface ActivityWithDetails extends Activity {
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  meeting?: {
    id: string;
    title: string;
  } | null;
}

export interface LogActivityData {
  userId: string;
  organizationId: string;
  action: ActivityAction;
  meetingId?: string;
  commentId?: string;
  annotationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFilters {
  meetingId?: string;
  userId?: string;
  action?: ActivityAction;
  limit?: number;
  offset?: number;
  before?: Date;
  after?: Date;
}

/**
 * Service for activity logging and retrieval
 */
export class ActivityService {
  /**
   * Log an activity event
   */
  async log(data: LogActivityData): Promise<Activity> {
    logger.debug({ action: data.action, userId: data.userId }, 'Logging activity');

    const activity = await prisma.activity.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.action,
        meetingId: data.meetingId,
        commentId: data.commentId,
        annotationId: data.annotationId,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    logger.debug({ activityId: activity.id }, 'Activity logged');
    return activity;
  }

  /**
   * Get activity feed for an organization
   */
  async getOrganizationFeed(
    organizationId: string,
    filters: ActivityFilters = {}
  ): Promise<{ activities: ActivityWithDetails[]; total: number }> {
    const { meetingId, userId, action, limit = 50, offset = 0, before, after } = filters;

    const where: Record<string, unknown> = { organizationId };

    if (meetingId) {
      where.meetingId = meetingId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (before || after) {
      where.createdAt = {};
      if (before) {
        (where.createdAt as Record<string, Date>).lt = before;
      }
      if (after) {
        (where.createdAt as Record<string, Date>).gt = after;
      }
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    // Fetch meeting details
    const meetingIds = [...new Set(activities.filter(a => a.meetingId).map(a => a.meetingId!))];
    const meetings = meetingIds.length > 0
      ? await prisma.meeting.findMany({
          where: { id: { in: meetingIds } },
          select: { id: true, title: true },
        })
      : [];

    const meetingMap = new Map(meetings.map(m => [m.id, m]));

    const activitiesWithDetails: ActivityWithDetails[] = activities.map(a => ({
      ...a,
      meeting: a.meetingId ? meetingMap.get(a.meetingId) || null : null,
    }));

    return { activities: activitiesWithDetails, total };
  }

  /**
   * Get activity feed for a specific meeting
   */
  async getMeetingFeed(
    meetingId: string,
    filters: Omit<ActivityFilters, 'meetingId'> = {}
  ): Promise<{ activities: ActivityWithDetails[]; total: number }> {
    return this.getOrganizationFeed('', { ...filters, meetingId });
  }

  /**
   * Get activity feed for a specific user
   */
  async getUserFeed(
    userId: string,
    organizationId: string,
    filters: Omit<ActivityFilters, 'userId'> = {}
  ): Promise<{ activities: ActivityWithDetails[]; total: number }> {
    return this.getOrganizationFeed(organizationId, { ...filters, userId });
  }

  /**
   * Get recent activity summary for dashboard
   */
  async getRecentSummary(
    organizationId: string,
    hours = 24
  ): Promise<{
    total: number;
    byAction: Record<ActivityAction, number>;
    byUser: Array<{ userId: string; name: string | null; count: number }>;
    recentMeetings: Array<{ meetingId: string; title: string; activityCount: number }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const activities = await prisma.activity.findMany({
      where: {
        organizationId,
        createdAt: { gte: since },
      },
      select: {
        action: true,
        userId: true,
        meetingId: true,
        user: {
          select: { name: true },
        },
      },
    });

    // Count by action
    const byAction = {} as Record<ActivityAction, number>;
    for (const a of activities) {
      byAction[a.action] = (byAction[a.action] || 0) + 1;
    }

    // Count by user
    const userCounts = new Map<string, { name: string | null; count: number }>();
    for (const a of activities) {
      const existing = userCounts.get(a.userId);
      if (existing) {
        existing.count++;
      } else {
        userCounts.set(a.userId, { name: a.user.name, count: 1 });
      }
    }

    const byUser = Array.from(userCounts.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count by meeting
    const meetingCounts = new Map<string, number>();
    for (const a of activities) {
      if (a.meetingId) {
        meetingCounts.set(a.meetingId, (meetingCounts.get(a.meetingId) || 0) + 1);
      }
    }

    // Get top meetings
    const topMeetingIds = Array.from(meetingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const meetings = topMeetingIds.length > 0
      ? await prisma.meeting.findMany({
          where: { id: { in: topMeetingIds } },
          select: { id: true, title: true },
        })
      : [];

    const meetingMap = new Map(meetings.map(m => [m.id, m]));

    const recentMeetings = topMeetingIds
      .map(id => ({
        meetingId: id,
        title: meetingMap.get(id)?.title || 'Unknown',
        activityCount: meetingCounts.get(id) || 0,
      }));

    return {
      total: activities.length,
      byAction,
      byUser,
      recentMeetings,
    };
  }

  /**
   * Format activity for display
   */
  formatActivity(activity: ActivityWithDetails): string {
    const userName = activity.user.name ||
      `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim() ||
      activity.user.email;

    const meetingTitle = activity.meeting?.title || 'a meeting';

    switch (activity.action) {
      case 'MEETING_CREATED':
        return `${userName} created "${meetingTitle}"`;
      case 'MEETING_UPDATED':
        return `${userName} updated "${meetingTitle}"`;
      case 'MEETING_SHARED':
        return `${userName} shared "${meetingTitle}"`;
      case 'MEETING_VIEWED':
        return `${userName} viewed "${meetingTitle}"`;
      case 'COMMENT_ADDED':
        return `${userName} commented on "${meetingTitle}"`;
      case 'COMMENT_REPLIED':
        return `${userName} replied to a comment on "${meetingTitle}"`;
      case 'COMMENT_RESOLVED':
        return `${userName} resolved a comment on "${meetingTitle}"`;
      case 'ANNOTATION_ADDED':
        return `${userName} added an annotation to "${meetingTitle}"`;
      case 'ANNOTATION_UPDATED':
        return `${userName} updated an annotation on "${meetingTitle}"`;
      case 'MEMBER_JOINED':
        return `${userName} joined the workspace`;
      case 'PERMISSION_CHANGED':
        return `${userName} changed sharing permissions on "${meetingTitle}"`;
      default:
        return `${userName} performed an action`;
    }
  }

  /**
   * Clean up old activities (older than 90 days)
   */
  async cleanup(): Promise<number> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await prisma.activity.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
      },
    });

    logger.info({ count: result.count }, 'Cleaned up old activities');
    return result.count;
  }
}

export const activityService = new ActivityService();
