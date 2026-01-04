/**
 * Action item repository for action item operations
 * Split from transcriptRepository.ts per governance file size limits
 */

import type { ActionItem, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { PaginationOptions, PaginatedResult, CreateActionItemInput } from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Action item statistics
 */
export interface ActionItemStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

/**
 * Repository for Action Item operations
 */
export class ActionItemRepository {
  /**
   * Finds action items by meeting ID
   */
  async findByMeetingId(meetingId: string): Promise<ActionItem[]> {
    return prisma.actionItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds an action item by ID
   */
  async findById(id: string): Promise<ActionItem | null> {
    return prisma.actionItem.findUnique({
      where: { id },
    });
  }

  /**
   * Finds action items by assignee across an organization
   */
  async findByAssignee(
    organizationId: string,
    assignee: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<ActionItem>> {
    const normalized = normalizePaginationOptions(options);

    const where: Prisma.ActionItemWhereInput = {
      assignee: { contains: assignee, mode: 'insensitive' },
      meeting: {
        organizationId,
        deletedAt: null,
      },
    };

    const [data, total] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
        include: { meeting: { select: { id: true, title: true } } },
      }),
      prisma.actionItem.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Finds pending (incomplete) action items for an organization
   */
  async findPending(organizationId: string, limit = 20): Promise<ActionItem[]> {
    return prisma.actionItem.findMany({
      where: {
        completed: false,
        meeting: {
          organizationId,
          deletedAt: null,
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      include: { meeting: { select: { id: true, title: true } } },
    });
  }

  /**
   * Finds overdue action items for an organization
   */
  async findOverdue(organizationId: string, limit = 20): Promise<ActionItem[]> {
    return prisma.actionItem.findMany({
      where: {
        completed: false,
        dueDate: { lt: new Date() },
        meeting: {
          organizationId,
          deletedAt: null,
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
      include: { meeting: { select: { id: true, title: true } } },
    });
  }

  /**
   * Creates an action item
   */
  async create(data: CreateActionItemInput): Promise<ActionItem> {
    return prisma.actionItem.create({
      data: {
        meetingId: data.meetingId,
        text: data.text,
        assignee: data.assignee,
        dueDate: data.dueDate,
      },
    });
  }

  /**
   * Creates multiple action items
   */
  async createMany(items: CreateActionItemInput[]): Promise<ActionItem[]> {
    await prisma.actionItem.createMany({
      data: items.map((item) => ({
        meetingId: item.meetingId,
        text: item.text,
        assignee: item.assignee,
        dueDate: item.dueDate,
      })),
    });

    const meetingIds = [...new Set(items.map((i) => i.meetingId))];
    return prisma.actionItem.findMany({
      where: { meetingId: { in: meetingIds } },
      orderBy: { createdAt: 'desc' },
      take: items.length,
    });
  }

  /**
   * Updates an action item
   */
  async update(
    id: string,
    data: Partial<{
      text: string;
      assignee: string;
      dueDate: Date;
      completed: boolean;
    }>
  ): Promise<ActionItem> {
    const updateData: Prisma.ActionItemUpdateInput = { ...data };

    if (data.completed === true) {
      updateData.completedAt = new Date();
    } else if (data.completed === false) {
      updateData.completedAt = null;
    }

    return prisma.actionItem.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Marks an action item as completed
   */
  async complete(id: string): Promise<ActionItem> {
    return this.update(id, { completed: true });
  }

  /**
   * Marks an action item as incomplete
   */
  async uncomplete(id: string): Promise<ActionItem> {
    return this.update(id, { completed: false });
  }

  /**
   * Deletes an action item
   */
  async delete(id: string): Promise<void> {
    await prisma.actionItem.delete({ where: { id } });
  }

  /**
   * Deletes all action items for a meeting
   */
  async deleteByMeetingId(meetingId: string): Promise<void> {
    await prisma.actionItem.deleteMany({ where: { meetingId } });
  }

  /**
   * Gets action item statistics for an organization
   */
  async getStats(organizationId: string): Promise<ActionItemStats> {
    const baseWhere = {
      meeting: {
        organizationId,
        deletedAt: null,
      },
    };

    const [total, completed, overdue] = await Promise.all([
      prisma.actionItem.count({ where: baseWhere }),
      prisma.actionItem.count({
        where: { ...baseWhere, completed: true },
      }),
      prisma.actionItem.count({
        where: {
          ...baseWhere,
          completed: false,
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      completed,
      pending: total - completed,
      overdue,
    };
  }
}

// Export singleton instance
export const actionItemRepository = new ActionItemRepository();
