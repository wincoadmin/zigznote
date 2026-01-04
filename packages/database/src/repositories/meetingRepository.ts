/**
 * Meeting repository for data access
 */

import type { Meeting, MeetingParticipant, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateMeetingInput,
  UpdateMeetingInput,
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
 * Repository for Meeting entity operations
 */
export class MeetingRepository {
  /**
   * Finds a meeting by ID
   * @param id - Meeting ID
   * @param include - Relations to include
   * @param includeDeleted - Include soft-deleted records
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
   * @param botId - Bot ID
   * @param include - Relations to include
   */
  async findByBotId(
    botId: string,
    include?: MeetingInclude
  ): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: {
        botId,
        deletedAt: null,
      },
      include,
    });
  }

  /**
   * Finds a meeting by calendar event ID
   * @param calendarEventId - Calendar event ID
   * @param include - Relations to include
   */
  async findByCalendarEventId(
    calendarEventId: string,
    include?: MeetingInclude
  ): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: {
        calendarEventId,
        deletedAt: null,
      },
      include,
    });
  }

  /**
   * Finds all meetings matching the filter
   * @param filter - Filter options
   * @param include - Relations to include
   */
  async findMany(
    filter?: MeetingFilterOptions,
    include?: MeetingInclude
  ): Promise<Meeting[]> {
    const where = this.buildWhereClause(filter);
    return prisma.meeting.findMany({
      where,
      include,
      orderBy: { startTime: 'desc' },
    });
  }

  /**
   * Finds meetings by organization with pagination
   * @param organizationId - Organization ID
   * @param options - Pagination options
   * @param filter - Additional filter options
   * @param include - Relations to include
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
   * @param options - Pagination options
   * @param filter - Filter options
   * @param include - Relations to include
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
   * @param organizationId - Organization ID
   * @param limit - Maximum number of meetings to return
   */
  async findUpcoming(
    organizationId: string,
    limit = 10
  ): Promise<Meeting[]> {
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
   * @param organizationId - Organization ID
   * @param limit - Maximum number of meetings to return
   */
  async findRecentCompleted(
    organizationId: string,
    limit = 10
  ): Promise<Meeting[]> {
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
   * Counts meetings matching the filter
   * @param filter - Filter options
   */
  async count(filter?: MeetingFilterOptions): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.meeting.count({ where });
  }

  /**
   * Creates a new meeting
   * @param data - Meeting data
   * @param include - Relations to include in returned record
   */
  async create(
    data: CreateMeetingInput,
    include?: MeetingInclude
  ): Promise<Meeting> {
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
        status: 'scheduled',
      },
      include,
    });
  }

  /**
   * Updates a meeting by ID
   * @param id - Meeting ID
   * @param data - Update data
   * @param include - Relations to include in returned record
   */
  async update(
    id: string,
    data: UpdateMeetingInput,
    include?: MeetingInclude
  ): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Updates meeting status
   * @param id - Meeting ID
   * @param status - New status
   */
  async updateStatus(
    id: string,
    status: string
  ): Promise<Meeting> {
    const updateData: Prisma.MeetingUpdateInput = { status };

    // Set timestamps based on status transition
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
   * @param id - Meeting ID
   */
  async softDelete(id: string): Promise<void> {
    await prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard deletes a meeting (permanent)
   * @param id - Meeting ID
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.meeting.delete({
      where: { id },
    });
  }

  /**
   * Restores a soft-deleted meeting
   * @param id - Meeting ID
   */
  async restore(id: string): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Adds participants to a meeting
   * @param meetingId - Meeting ID
   * @param participants - Array of participant data
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

    return prisma.meetingParticipant.findMany({
      where: { meetingId },
    });
  }

  /**
   * Gets participants for a meeting
   * @param meetingId - Meeting ID
   */
  async getParticipants(meetingId: string): Promise<MeetingParticipant[]> {
    return prisma.meetingParticipant.findMany({
      where: { meetingId },
    });
  }

  /**
   * Gets meeting statistics for an organization
   * @param organizationId - Organization ID
   */
  async getStats(organizationId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalDuration: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, byStatus, totalDuration, thisWeek, thisMonth] =
      await Promise.all([
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
   * Builds Prisma where clause from filter options
   */
  private buildWhereClause(
    filter?: MeetingFilterOptions
  ): Prisma.MeetingWhereInput {
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

    return where;
  }
}

// Export singleton instance
export const meetingRepository = new MeetingRepository();
