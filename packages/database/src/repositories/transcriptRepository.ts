/**
 * @ownership
 * @domain Transcript Management
 * @description Transcript CRUD and search operations
 * @invariants Transcripts must have meetingId
 * @split-plan Summaries in summaryRepository, action items in actionItemRepository
 * @last-reviewed 2026-01-04
 */

import type { Transcript, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { CreateTranscriptInput, TranscriptSearchOptions, SearchResult } from '../types';
import { extractHighlights } from '../utils/search';

/**
 * Include options for transcript queries
 */
export interface TranscriptInclude {
  meeting?: boolean;
}

/**
 * Repository for Transcript operations
 */
export class TranscriptRepository {
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
  async create(data: CreateTranscriptInput, include?: TranscriptInclude): Promise<Transcript> {
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
  async update(id: string, data: Partial<CreateTranscriptInput>): Promise<Transcript> {
    return prisma.transcript.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a transcript
   */
  async delete(id: string): Promise<void> {
    await prisma.transcript.delete({ where: { id } });
  }

  /**
   * Checks if a transcript exists for a meeting
   */
  async exists(meetingId: string): Promise<boolean> {
    const count = await prisma.transcript.count({
      where: { meetingId },
    });
    return count > 0;
  }

  /**
   * Searches transcripts using full-text search
   */
  async search(options: TranscriptSearchOptions): Promise<SearchResult<Transcript>[]> {
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
}

// Export singleton instance
export const transcriptRepository = new TranscriptRepository();

// Re-export from split repositories for backward compatibility
export { summaryRepository, SummaryRepository } from './summaryRepository';
export { actionItemRepository, ActionItemRepository } from './actionItemRepository';
