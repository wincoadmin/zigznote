/**
 * Transcript repository for data access
 */

import type {
  Transcript,
  Summary,
  ActionItem,
  Prisma,
} from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateTranscriptInput,
  CreateSummaryInput,
  CreateActionItemInput,
  TranscriptSearchOptions,
  SearchResult,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';
import { extractHighlights } from '../utils/search';

/**
 * Include options for transcript queries
 */
export interface TranscriptInclude {
  meeting?: boolean;
}

/**
 * Repository for Transcript and related content operations
 */
export class TranscriptRepository {
  // ==================== Transcript Operations ====================

  /**
   * Finds a transcript by ID
   * @param id - Transcript ID
   * @param include - Relations to include
   */
  async findById(
    id: string,
    include?: TranscriptInclude
  ): Promise<Transcript | null> {
    return prisma.transcript.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Finds a transcript by meeting ID
   * @param meetingId - Meeting ID
   * @param include - Relations to include
   */
  async findByMeetingId(
    meetingId: string,
    include?: TranscriptInclude
  ): Promise<Transcript | null> {
    return prisma.transcript.findUnique({
      where: { meetingId },
      include,
    });
  }

  /**
   * Creates a transcript for a meeting
   * @param data - Transcript data
   * @param include - Relations to include in returned record
   */
  async createTranscript(
    data: CreateTranscriptInput,
    include?: TranscriptInclude
  ): Promise<Transcript> {
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
   * @param id - Transcript ID
   * @param data - Update data
   */
  async updateTranscript(
    id: string,
    data: Partial<CreateTranscriptInput>
  ): Promise<Transcript> {
    return prisma.transcript.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a transcript
   * @param id - Transcript ID
   */
  async deleteTranscript(id: string): Promise<void> {
    await prisma.transcript.delete({
      where: { id },
    });
  }

  /**
   * Searches transcripts using full-text search
   * @param options - Search options
   */
  async searchTranscripts(
    options: TranscriptSearchOptions
  ): Promise<SearchResult<Transcript>[]> {
    const { query, organizationId, meetingId, language, limit = 20 } = options;

    // Build where clause
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

    // Get transcripts that match the text
    const transcripts = await prisma.transcript.findMany({
      where: {
        ...where,
        fullText: { contains: query, mode: 'insensitive' },
      },
      include: { meeting: true },
      take: limit,
    });

    // Score and add highlights
    return transcripts.map((transcript) => {
      const lowerText = transcript.fullText.toLowerCase();
      const lowerQuery = query.toLowerCase();

      // Simple scoring: count occurrences
      const occurrences = (
        lowerText.match(new RegExp(lowerQuery, 'g')) || []
      ).length;
      const score = occurrences / transcript.wordCount;

      return {
        item: transcript,
        score,
        highlights: extractHighlights(transcript.fullText, query),
      };
    });
  }

  // ==================== Summary Operations ====================

  /**
   * Finds a summary by meeting ID
   * @param meetingId - Meeting ID
   */
  async findSummaryByMeetingId(meetingId: string): Promise<Summary | null> {
    return prisma.summary.findUnique({
      where: { meetingId },
    });
  }

  /**
   * Creates a summary for a meeting
   * @param data - Summary data
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
   * @param meetingId - Meeting ID
   * @param data - Update data
   */
  async updateSummary(
    meetingId: string,
    data: Partial<CreateSummaryInput>
  ): Promise<Summary> {
    return prisma.summary.update({
      where: { meetingId },
      data,
    });
  }

  /**
   * Upserts a summary (creates or updates)
   * @param data - Summary data
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
   * @param meetingId - Meeting ID
   */
  async deleteSummary(meetingId: string): Promise<void> {
    await prisma.summary.delete({
      where: { meetingId },
    });
  }

  // ==================== Action Item Operations ====================

  /**
   * Finds action items by meeting ID
   * @param meetingId - Meeting ID
   */
  async findActionItemsByMeetingId(meetingId: string): Promise<ActionItem[]> {
    return prisma.actionItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds action items by assignee across an organization
   * @param organizationId - Organization ID
   * @param assignee - Assignee name or email
   * @param options - Pagination options
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
   * @param organizationId - Organization ID
   * @param limit - Maximum number to return
   */
  async findPendingActionItems(
    organizationId: string,
    limit = 20
  ): Promise<ActionItem[]> {
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
   * Creates an action item
   * @param data - Action item data
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
   * @param items - Array of action item data
   */
  async createActionItems(
    items: CreateActionItemInput[]
  ): Promise<ActionItem[]> {
    await prisma.actionItem.createMany({
      data: items.map((item) => ({
        meetingId: item.meetingId,
        text: item.text,
        assignee: item.assignee,
        dueDate: item.dueDate,
      })),
    });

    // Return the created items
    const meetingIds = [...new Set(items.map((i) => i.meetingId))];
    return prisma.actionItem.findMany({
      where: { meetingId: { in: meetingIds } },
      orderBy: { createdAt: 'desc' },
      take: items.length,
    });
  }

  /**
   * Updates an action item
   * @param id - Action item ID
   * @param data - Update data
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

    // Set completedAt when marking as completed
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
   * @param id - Action item ID
   */
  async completeActionItem(id: string): Promise<ActionItem> {
    return this.updateActionItem(id, { completed: true });
  }

  /**
   * Marks an action item as incomplete
   * @param id - Action item ID
   */
  async uncompleteActionItem(id: string): Promise<ActionItem> {
    return this.updateActionItem(id, { completed: false });
  }

  /**
   * Deletes an action item
   * @param id - Action item ID
   */
  async deleteActionItem(id: string): Promise<void> {
    await prisma.actionItem.delete({
      where: { id },
    });
  }

  /**
   * Deletes all action items for a meeting
   * @param meetingId - Meeting ID
   */
  async deleteActionItemsByMeetingId(meetingId: string): Promise<void> {
    await prisma.actionItem.deleteMany({
      where: { meetingId },
    });
  }

  /**
   * Gets action item statistics for an organization
   * @param organizationId - Organization ID
   */
  async getActionItemStats(organizationId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  }> {
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
