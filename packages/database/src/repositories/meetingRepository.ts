/**
 * @ownership
 * @domain Meeting Management
 * @description Handles all database operations for meetings (CRUD, queries, stats)
 * @single-responsibility YES — one entity, complete coverage
 * @last-reviewed 2026-01-04
 */

import type { Meeting, MeetingParticipant, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  PaginationOptions,
  PaginatedResult,
  MeetingFilterOptions,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Include options for meeting queries
 */
export interface MeetingInclude {
  organization?: boolean;
  createdBy?: boolean;
  participants?: boolean;
  transcript?: boolean;
  summary?: boolean;
  actionItems?: boolean;
  embeddings?: boolean;
}

/**
 * Meeting with full relations
 */
export type MeetingWithRelations = Meeting & {
  participants?: MeetingParticipant[];
  transcript?: { id: string; fullText: string; wordCount: number } | null;
  summary?: { id: string; content: Prisma.JsonValue } | null;
  actionItems?: Array<{
    id: string;
    text: string;
    assignee: string | null;
    completed: boolean;
  }>;
};

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
 * Repository for Meeting entity — all operations
 */
export class MeetingRepository {
  // ============================================================
  // CRUD Operations
  // ============================================================

  /**
   * Finds a meeting by ID
   */
  async findById(
    id: string,
    include?: MeetingInclude,
    includeDeleted = false
  ): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include,
    });
  }

  /**
   * Finds a meeting by bot ID (Recall.ai bot)
   */
  async findByBotId(botId: string, include?: MeetingInclude): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: { botId, deletedAt: null },
      include,
    });
  }

  /**
   * Finds a meeting by calendar event ID
   */
  async findByCalendarEventId(
    calendarEventId: string,
    include?: MeetingInclude
  ): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: { calendarEventId, deletedAt: null },
      include,
    });
  }

  /**
   * Creates a new meeting
   */
  async create(data: CreateMeetingInput, include?: MeetingInclude): Promise<Meeting> {
    return prisma.meeting.create({
      data: {
        organizationId: data.organizationId,
        createdById: data.createdById,
        title: data.title,
        platform: data.platform,
        meetingUrl: data.meetingUrl,
        startTime: data.startTime,
        endTime: data.endTime,
        calendarEventId: data.calendarEventId,
        metadata: data.metadata ?? {},
        status: data.status ?? 'scheduled',
        // Audio source tracking
        source: data.source ?? 'bot',
        audioFileUrl: data.audioFileUrl,
        audioFileName: data.audioFileName,
        audioFileSize: data.audioFileSize,
        audioDuration: data.audioDuration,
      },
      include,
    });
  }

  /**
   * Updates a meeting by ID
   */
  async update(id: string, data: UpdateMeetingInput, include?: MeetingInclude): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Updates meeting status
   */
  async updateStatus(id: string, status: string): Promise<Meeting> {
    const updateData: Prisma.MeetingUpdateInput = { status };

    if (status === 'recording') {
      updateData.startTime = new Date();
    } else if (status === 'completed') {
      const meeting = await this.findById(id);
      if (meeting?.startTime) {
        updateData.endTime = new Date();
        updateData.durationSeconds = Math.floor(
          (Date.now() - meeting.startTime.getTime()) / 1000
        );
      }
    }

    return prisma.meeting.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft deletes a meeting
   */
  async softDelete(id: string): Promise<void> {
    await prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard deletes a meeting (permanent)
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.meeting.delete({ where: { id } });
  }

  /**
   * Restores a soft-deleted meeting
   */
  async restore(id: string): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // ============================================================
  // Participants
  // ============================================================

  /**
   * Adds participants to a meeting
   */
  async addParticipants(
    meetingId: string,
    participants: Array<{
      name: string;
      email?: string;
      speakerLabel?: string;
      isHost?: boolean;
    }>
  ): Promise<MeetingParticipant[]> {
    await prisma.meetingParticipant.createMany({
      data: participants.map((p) => ({
        meetingId,
        name: p.name,
        email: p.email,
        speakerLabel: p.speakerLabel,
        isHost: p.isHost ?? false,
      })),
    });

    return prisma.meetingParticipant.findMany({ where: { meetingId } });
  }

  /**
   * Gets participants for a meeting
   */
  async getParticipants(meetingId: string): Promise<MeetingParticipant[]> {
    return prisma.meetingParticipant.findMany({ where: { meetingId } });
  }

  // ============================================================
  // Query Operations
  // ============================================================

  /**
   * Finds meetings by organization with pagination
   */
  async findByOrganization(
    organizationId: string,
    options: PaginationOptions,
    filter?: Omit<MeetingFilterOptions, 'organizationId'>,
    include?: MeetingInclude
  ): Promise<PaginatedResult<Meeting>> {
    return this.findManyPaginated(
      options,
      { ...filter, organizationId },
      include
    );
  }

  /**
   * Finds meetings with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: MeetingFilterOptions,
    include?: MeetingInclude
  ): Promise<PaginatedResult<Meeting>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include,
        orderBy: { startTime: 'desc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.meeting.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Finds upcoming meetings for an organization
   */
  async findUpcoming(organizationId: string, limit = 10): Promise<Meeting[]> {
    return prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: 'scheduled',
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  /**
   * Finds recent completed meetings for an organization
   */
  async findRecentCompleted(organizationId: string, limit = 10): Promise<Meeting[]> {
    return prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: 'completed',
      },
      orderBy: { endTime: 'desc' },
      take: limit,
      include: {
        participants: true,
        summary: true,
      },
    });
  }

  /**
   * Finds all meetings matching the filter
   */
  async findMany(filter?: MeetingFilterOptions, include?: MeetingInclude): Promise<Meeting[]> {
    const where = this.buildWhereClause(filter);
    return prisma.meeting.findMany({
      where,
      include,
      orderBy: { startTime: 'desc' },
    });
  }

  /**
   * Counts meetings matching the filter
   */
  async count(filter?: MeetingFilterOptions): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.meeting.count({ where });
  }

  /**
   * Builds Prisma where clause from filter options
   */
  buildWhereClause(filter?: MeetingFilterOptions): Prisma.MeetingWhereInput {
    const where: Prisma.MeetingWhereInput = {};

    if (!filter?.includeDeleted) {
      where.deletedAt = null;
    }

    if (filter?.organizationId) {
      where.organizationId = filter.organizationId;
    }

    if (filter?.createdById) {
      where.createdById = filter.createdById;
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        where.status = { in: filter.status };
      } else {
        where.status = filter.status;
      }
    }

    if (filter?.platform) {
      where.platform = filter.platform;
    }

    if (filter?.startTimeFrom || filter?.startTimeTo) {
      where.startTime = {};
      if (filter.startTimeFrom) {
        where.startTime.gte = filter.startTimeFrom;
      }
      if (filter.startTimeTo) {
        where.startTime.lte = filter.startTimeTo;
      }
    }

    if (filter?.search) {
      where.title = { contains: filter.search, mode: 'insensitive' };
    }

    if (filter?.calendarEventId) {
      where.calendarEventId = filter.calendarEventId;
    }

    return where;
  }

  // ============================================================
  // Statistics Operations
  // ============================================================

  /**
   * Gets meeting statistics for an organization
   */
  async getStats(organizationId: string): Promise<MeetingStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, byStatus, totalDuration, thisWeek, thisMonth] = await Promise.all([
      this.count({ organizationId }),
      prisma.meeting.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: { status: true },
      }),
      prisma.meeting.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { durationSeconds: true },
      }),
      this.count({
        organizationId,
        startTimeFrom: weekAgo,
      }),
      this.count({
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
export const meetingRepository = new MeetingRepository();
