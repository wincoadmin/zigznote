/**
 * Search service
 * Unified search across meetings, transcripts, and summaries
 */

import { prisma } from '@zigznote/database';
import {
  escapeSearchQuery,
  extractHighlights,
} from '@zigznote/database';
import { Prisma } from '@zigznote/database';

export interface SearchOptions {
  query: string;
  organizationId: string;
  userId?: string;
  types?: ('meeting' | 'transcript' | 'summary' | 'action_item')[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  type: 'meeting' | 'transcript' | 'summary' | 'action_item';
  title: string;
  preview: string;
  highlights: string[];
  score: number;
  meetingId: string;
  meetingTitle?: string;
  meetingDate?: Date;
  createdAt: Date;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number; // milliseconds
}

class SearchService {
  /**
   * Unified search across all content types
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const {
      query,
      organizationId,
      userId,
      types = ['meeting', 'transcript', 'summary', 'action_item'],
      dateRange,
      limit = 20,
      offset = 0,
    } = options;

    if (!query.trim()) {
      return {
        results: [],
        total: 0,
        query,
        took: 0,
      };
    }

    const allResults: SearchResult[] = [];

    // Search meetings
    if (types.includes('meeting')) {
      const meetingResults = await this.searchMeetings(
        query,
        organizationId,
        dateRange
      );
      allResults.push(...meetingResults);
    }

    // Search transcripts
    if (types.includes('transcript')) {
      const transcriptResults = await this.searchTranscripts(
        query,
        organizationId,
        dateRange
      );
      allResults.push(...transcriptResults);
    }

    // Search summaries
    if (types.includes('summary')) {
      const summaryResults = await this.searchSummaries(
        query,
        organizationId,
        dateRange
      );
      allResults.push(...summaryResults);
    }

    // Search action items
    if (types.includes('action_item')) {
      const actionResults = await this.searchActionItems(
        query,
        organizationId,
        userId,
        dateRange
      );
      allResults.push(...actionResults);
    }

    // Sort by score
    allResults.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedResults = allResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: allResults.length,
      query,
      took: Date.now() - startTime,
    };
  }

  /**
   * Search meetings by title and participant names
   */
  private async searchMeetings(
    query: string,
    organizationId: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<SearchResult[]> {
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(dateRange?.start && { startTime: { gte: dateRange.start } }),
        ...(dateRange?.end && { startTime: { lte: dateRange.end } }),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        platform: true,
        status: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { startTime: 'desc' },
    });

    return meetings.map((meeting) => {
      const score = this.calculateTextScore(meeting.title || '', query);

      return {
        id: meeting.id,
        type: 'meeting' as const,
        title: meeting.title || 'Untitled Meeting',
        preview: `${meeting.platform} meeting on ${meeting.startTime?.toLocaleDateString() || 'TBD'}`,
        highlights: extractHighlights(meeting.title || '', query),
        score,
        meetingId: meeting.id,
        meetingTitle: meeting.title || undefined,
        meetingDate: meeting.startTime || undefined,
        createdAt: meeting.createdAt,
      };
    });
  }

  /**
   * Search transcripts using full-text search
   */
  private async searchTranscripts(
    query: string,
    organizationId: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<SearchResult[]> {
    const escapedQuery = escapeSearchQuery(query);

    if (!escapedQuery) return [];

    // Use raw query for full-text search
    const transcripts = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      meeting_id: string;
      meeting_title: string;
      meeting_start_time: Date | null;
      created_at: Date;
      rank: number;
    }>>`
      SELECT
        t.id,
        LEFT(t.content, 500) as content,
        t.meeting_id,
        m.title as meeting_title,
        m.start_time as meeting_start_time,
        t.created_at,
        ts_rank(to_tsvector('english', t.content), plainto_tsquery('english', ${escapedQuery})) as rank
      FROM transcripts t
      JOIN meetings m ON t.meeting_id = m.id
      WHERE m.organization_id = ${organizationId}
        AND m.deleted_at IS NULL
        AND to_tsvector('english', t.content) @@ plainto_tsquery('english', ${escapedQuery})
        ${dateRange?.start ? Prisma.sql`AND m.start_time >= ${dateRange.start}` : Prisma.empty}
        ${dateRange?.end ? Prisma.sql`AND m.start_time <= ${dateRange.end}` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT 50
    `;

    return transcripts.map((t) => ({
      id: t.id,
      type: 'transcript' as const,
      title: `Transcript: ${t.meeting_title || 'Untitled Meeting'}`,
      preview: t.content.substring(0, 200) + '...',
      highlights: extractHighlights(t.content, query),
      score: t.rank,
      meetingId: t.meeting_id,
      meetingTitle: t.meeting_title || undefined,
      meetingDate: t.meeting_start_time || undefined,
      createdAt: t.created_at,
    }));
  }

  /**
   * Search summaries
   */
  private async searchSummaries(
    query: string,
    organizationId: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<SearchResult[]> {
    const escapedQuery = escapeSearchQuery(query);

    if (!escapedQuery) return [];

    const summaries = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      meeting_id: string;
      meeting_title: string;
      meeting_start_time: Date | null;
      created_at: Date;
      rank: number;
    }>>`
      SELECT
        s.id,
        LEFT(s.content, 500) as content,
        s.meeting_id,
        m.title as meeting_title,
        m.start_time as meeting_start_time,
        s.created_at,
        ts_rank(to_tsvector('english', s.content), plainto_tsquery('english', ${escapedQuery})) as rank
      FROM summaries s
      JOIN meetings m ON s.meeting_id = m.id
      WHERE m.organization_id = ${organizationId}
        AND m.deleted_at IS NULL
        AND to_tsvector('english', s.content) @@ plainto_tsquery('english', ${escapedQuery})
        ${dateRange?.start ? Prisma.sql`AND m.start_time >= ${dateRange.start}` : Prisma.empty}
        ${dateRange?.end ? Prisma.sql`AND m.start_time <= ${dateRange.end}` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT 50
    `;

    return summaries.map((s) => ({
      id: s.id,
      type: 'summary' as const,
      title: `Summary: ${s.meeting_title || 'Untitled Meeting'}`,
      preview: s.content.substring(0, 200) + '...',
      highlights: extractHighlights(s.content, query),
      score: s.rank,
      meetingId: s.meeting_id,
      meetingTitle: s.meeting_title || undefined,
      meetingDate: s.meeting_start_time || undefined,
      createdAt: s.created_at,
    }));
  }

  /**
   * Search action items
   */
  private async searchActionItems(
    query: string,
    organizationId: string,
    _userId?: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<SearchResult[]> {
    const actionItems = await prisma.actionItem.findMany({
      where: {
        meeting: {
          organizationId,
          deletedAt: null,
          ...(dateRange?.start && { startTime: { gte: dateRange.start } }),
          ...(dateRange?.end && { startTime: { lte: dateRange.end } }),
        },
        text: { contains: query, mode: 'insensitive' },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return actionItems.map((item) => {
      const score = this.calculateTextScore(item.text, query);

      return {
        id: item.id,
        type: 'action_item' as const,
        title: item.text.substring(0, 100),
        preview: item.text,
        highlights: extractHighlights(item.text, query),
        score,
        meetingId: item.meetingId,
        meetingTitle: item.meeting?.title || undefined,
        meetingDate: item.meeting?.startTime || undefined,
        createdAt: item.createdAt,
      };
    });
  }

  /**
   * Get search suggestions based on recent searches and popular terms
   */
  async getSuggestions(
    prefix: string,
    organizationId: string,
    limit = 5
  ): Promise<string[]> {
    if (!prefix || prefix.length < 2) return [];

    // Get recent meeting titles matching prefix
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
        title: { startsWith: prefix, mode: 'insensitive' },
      },
      select: { title: true },
      take: limit,
      orderBy: { startTime: 'desc' },
    });

    return meetings
      .map((m) => m.title)
      .filter((t): t is string => t !== null);
  }

  /**
   * Calculate simple text match score
   */
  private calculateTextScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    let score = 0;

    // Exact match bonus
    if (lowerText.includes(query.toLowerCase())) {
      score += 1;
    }

    // Term match scoring
    for (const term of terms) {
      if (lowerText.includes(term)) {
        score += 0.3;
      }
    }

    // Title starts with query bonus
    if (lowerText.startsWith(query.toLowerCase())) {
      score += 0.5;
    }

    return Math.min(score, 2); // Cap at 2
  }
}

export const searchService = new SearchService();
