/**
 * Meeting statistics repository
 * Split from meetingRepository.ts per governance file size limits
 */

import { prisma } from '../client';
import type { MeetingFilterOptions } from '../types';
import { MeetingQueryRepository } from './meetingQueryRepository';

const queryRepo = new MeetingQueryRepository();

/**
 * Meeting statistics result
 */
export interface MeetingStats {
  total: number;
  byStatus: Record<string, number>;
  totalDuration: number;
  thisWeek: number;
  thisMonth: number;
}

/**
 * Detailed meeting analytics
 */
export interface MeetingAnalytics {
  totalMeetings: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number;
  meetingsByPlatform: Record<string, number>;
  meetingsByStatus: Record<string, number>;
  meetingsPerWeek: Array<{ week: string; count: number }>;
}

/**
 * Repository for meeting statistics and analytics
 */
export class MeetingStatsRepository {
  /**
   * Gets meeting statistics for an organization
   */
  async getStats(organizationId: string): Promise<MeetingStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, byStatus, totalDuration, thisWeek, thisMonth] = await Promise.all([
      queryRepo.count({ organizationId }),
      prisma.meeting.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: { status: true },
      }),
      prisma.meeting.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { durationSeconds: true },
      }),
      queryRepo.count({
        organizationId,
        startTimeFrom: weekAgo,
      }),
      queryRepo.count({
        organizationId,
        startTimeFrom: monthAgo,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const group of byStatus) {
      statusCounts[group.status] = group._count.status;
    }

    return {
      total,
      byStatus: statusCounts,
      totalDuration: totalDuration._sum.durationSeconds ?? 0,
      thisWeek,
      thisMonth,
    };
  }

  /**
   * Gets detailed meeting analytics for an organization
   */
  async getAnalytics(
    organizationId: string,
    filter?: MeetingFilterOptions
  ): Promise<MeetingAnalytics> {
    const where = {
      organizationId,
      deletedAt: null,
      ...(filter?.startTimeFrom && { startTime: { gte: filter.startTimeFrom } }),
      ...(filter?.startTimeTo && { startTime: { lte: filter.startTimeTo } }),
    };

    const [meetings, byPlatform, byStatus, aggregates] = await Promise.all([
      prisma.meeting.findMany({
        where,
        select: { startTime: true },
      }),
      prisma.meeting.groupBy({
        by: ['platform'],
        where,
        _count: { platform: true },
      }),
      prisma.meeting.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.meeting.aggregate({
        where,
        _sum: { durationSeconds: true },
        _avg: { durationSeconds: true },
        _count: true,
      }),
    ]);

    // Build platform counts
    const meetingsByPlatform: Record<string, number> = {};
    for (const group of byPlatform) {
      if (group.platform) {
        meetingsByPlatform[group.platform] = group._count.platform;
      }
    }

    // Build status counts
    const meetingsByStatus: Record<string, number> = {};
    for (const group of byStatus) {
      meetingsByStatus[group.status] = group._count.status;
    }

    // Build weekly counts
    const weeklyMap = new Map<string, number>();
    for (const meeting of meetings) {
      if (meeting.startTime) {
        const weekStart = getWeekStart(meeting.startTime);
        const key = weekStart.toISOString().split('T')[0]!;
        weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + 1);
      }
    }
    const meetingsPerWeek = Array.from(weeklyMap.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return {
      totalMeetings: aggregates._count,
      totalDurationMinutes: Math.round((aggregates._sum.durationSeconds ?? 0) / 60),
      averageDurationMinutes: Math.round((aggregates._avg.durationSeconds ?? 0) / 60),
      meetingsByPlatform,
      meetingsByStatus,
      meetingsPerWeek,
    };
  }

  /**
   * Gets meeting count by date range
   */
  async getCountByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return prisma.meeting.count({
      where: {
        organizationId,
        deletedAt: null,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }
}

/**
 * Gets the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Export singleton instance
export const meetingStatsRepository = new MeetingStatsRepository();
