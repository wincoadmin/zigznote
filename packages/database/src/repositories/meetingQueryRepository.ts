/**
 * Meeting query repository for complex queries and filtering
 * Split from meetingRepository.ts per governance file size limits
 */

import type { Meeting, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  MeetingFilterOptions,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';
import type { MeetingInclude } from './meetingRepository';

/**
 * Repository for complex meeting queries and filtering
 */
export class MeetingQueryRepository {
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

    return where;
  }
}

// Export singleton instance
export const meetingQueryRepository = new MeetingQueryRepository();
