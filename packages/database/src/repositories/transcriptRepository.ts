/**
 * @ownership
 * @domain Transcript & Content Management
 * @description Handles all transcript, summary, and action item operations
 * @single-responsibility YES — one domain (meeting content), complete coverage
 * @last-reviewed 2026-01-04
 */

import type { Transcript, Summary, ActionItem, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  CreateTranscriptInput,
  CreateSummaryInput,
  CreateActionItemInput,
  TranscriptSearchOptions,
  SearchResult,
  PaginationOptions,
  PaginatedResult,
} from '../types';
import { extractHighlights } from '../utils/search';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Include options for transcript queries
 */
export interface TranscriptInclude {
  meeting?: boolean;
}

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
 * Repository for Transcript, Summary, and ActionItem operations
 */
export class TranscriptRepository {
  // ============================================================
  // Transcript Operations
  // ============================================================

  /**
   * Finds a transcript by ID
   */
  async findById(id: string, include?: TranscriptInclude): Promise<Transcript | null> {
    return prisma.transcript.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Finds a transcript by meeting ID
   */
  async findByMeetingId(meetingId: string, include?: TranscriptInclude): Promise<Transcript | null> {
    return prisma.transcript.findUnique({
      where: { meetingId },
      include,
    });
  }

  /**
   * Creates a transcript for a meeting
   */
  async createTranscript(data: CreateTranscriptInput, include?: TranscriptInclude): Promise<Transcript> {
    return prisma.transcript.create({
      data: {
        meetingId: data.meetingId,
        segments: data.segments,
        fullText: data.fullText,
        wordCount: data.wordCount,
        language: data.language ?? 'en',
      },
      include,
    });
  }

  /**
   * Updates a transcript
   */
  async updateTranscript(id: string, data: Partial<CreateTranscriptInput>): Promise<Transcript> {
    return prisma.transcript.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a transcript
   */
  async deleteTranscript(id: string): Promise<void> {
    await prisma.transcript.delete({ where: { id } });
  }

  /**
   * Checks if a transcript exists for a meeting
   */
  async transcriptExists(meetingId: string): Promise<boolean> {
    const count = await prisma.transcript.count({
      where: { meetingId },
    });
    return count > 0;
  }

  /**
   * Searches transcripts using full-text search
   */
  async searchTranscripts(options: TranscriptSearchOptions): Promise<SearchResult<Transcript>[]> {
    const { query, organizationId, meetingId, language, limit = 20 } = options;

    const where: Prisma.TranscriptWhereInput = {};

    if (meetingId) {
      where.meetingId = meetingId;
    }

    if (language) {
      where.language = language;
    }

    if (organizationId) {
      where.meeting = {
        organizationId,
        deletedAt: null,
      };
    }

    const transcripts = await prisma.transcript.findMany({
      where: {
        ...where,
        fullText: { contains: query, mode: 'insensitive' },
      },
      include: { meeting: true },
      take: limit,
    });

    return transcripts.map((transcript) => {
      const lowerText = transcript.fullText.toLowerCase();
      const lowerQuery = query.toLowerCase();

      const occurrences = (lowerText.match(new RegExp(lowerQuery, 'g')) || []).length;
      const score = occurrences / transcript.wordCount;

      return {
        item: transcript,
        score,
        highlights: extractHighlights(transcript.fullText, query),
      };
    });
  }

  /**
   * Gets transcript word count statistics for an organization
   */
  async getWordCountStats(organizationId: string): Promise<{
    totalWords: number;
    averageWords: number;
    transcriptCount: number;
  }> {
    const stats = await prisma.transcript.aggregate({
      where: {
        meeting: {
          organizationId,
          deletedAt: null,
        },
      },
      _sum: { wordCount: true },
      _avg: { wordCount: true },
      _count: true,
    });

    return {
      totalWords: stats._sum.wordCount ?? 0,
      averageWords: Math.round(stats._avg.wordCount ?? 0),
      transcriptCount: stats._count,
    };
  }

  // ============================================================
  // Summary Operations
  // ============================================================

  /**
   * Finds a summary by meeting ID
   */
  async findSummaryByMeetingId(meetingId: string): Promise<Summary | null> {
    return prisma.summary.findUnique({
      where: { meetingId },
    });
  }

  /**
   * Finds a summary by ID
   */
  async findSummaryById(id: string): Promise<Summary | null> {
    return prisma.summary.findUnique({
      where: { id },
    });
  }

  /**
   * Creates a summary for a meeting
   */
  async createSummary(data: CreateSummaryInput): Promise<Summary> {
    return prisma.summary.create({
      data: {
        meetingId: data.meetingId,
        content: data.content,
        modelUsed: data.modelUsed,
        promptVersion: data.promptVersion,
      },
    });
  }

  /**
   * Updates a summary
   */
  async updateSummary(meetingId: string, data: Partial<CreateSummaryInput>): Promise<Summary> {
    return prisma.summary.update({
      where: { meetingId },
      data,
    });
  }

  /**
   * Upserts a summary (creates or updates)
   */
  async upsertSummary(data: CreateSummaryInput): Promise<Summary> {
    return prisma.summary.upsert({
      where: { meetingId: data.meetingId },
      create: data,
      update: {
        content: data.content,
        modelUsed: data.modelUsed,
        promptVersion: data.promptVersion,
      },
    });
  }

  /**
   * Deletes a summary
   */
  async deleteSummary(meetingId: string): Promise<void> {
    await prisma.summary.delete({
      where: { meetingId },
    });
  }

  /**
   * Checks if a summary exists for a meeting
   */
  async summaryExists(meetingId: string): Promise<boolean> {
    const count = await prisma.summary.count({
      where: { meetingId },
    });
    return count > 0;
  }

  // ============================================================
  // Action Item Operations
  // ============================================================

  /**
   * Finds action items by meeting ID
   */
  async findActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]> {
    return prisma.actionItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds an action item by ID
   */
  async findActionItemById(id: string): Promise<ActionItem | null> {
    return prisma.actionItem.findUnique({
      where: { id },
    });
  }

  /**
   * Finds action items by assignee across an organization
   */
  async findActionItemsByAssignee(
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
  async findPendingActionItems(organizationId: string, limit = 20): Promise<ActionItem[]> {
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
  async findOverdueActionItems(organizationId: string, limit = 20): Promise<ActionItem[]> {
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
  async createActionItem(data: CreateActionItemInput): Promise<ActionItem> {
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
  async createActionItems(items: CreateActionItemInput[]): Promise<ActionItem[]> {
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
  async updateActionItem(
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
  async completeActionItem(id: string): Promise<ActionItem> {
    return this.updateActionItem(id, { completed: true });
  }

  /**
   * Marks an action item as incomplete
   */
  async uncompleteActionItem(id: string): Promise<ActionItem> {
    return this.updateActionItem(id, { completed: false });
  }

  /**
   * Deletes an action item
   */
  async deleteActionItem(id: string): Promise<void> {
    await prisma.actionItem.delete({ where: { id } });
  }

  /**
   * Deletes all action items for a meeting
   */
  async deleteActionItemsByMeetingId(meetingId: string): Promise<void> {
    await prisma.actionItem.deleteMany({ where: { meetingId } });
  }

  /**
   * Gets action item statistics for an organization
   */
  async getActionItemStats(organizationId: string): Promise<ActionItemStats> {
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
export const transcriptRepository = new TranscriptRepository();
