/**
 * @ownership
 * @domain Meeting Management
 * @description Business logic for meeting operations including CRUD, access control, and related data
 * @invariants All operations require organizationId for multi-tenant access control
 * @last-reviewed 2026-01-04
 */

import {
  meetingRepository,
  transcriptRepository,
} from '@zigznote/database';
import type { Meeting, Transcript, Summary, ActionItem } from '@zigznote/database';
import { logger } from '../utils/logger';
import { errors } from '../utils/errors';

/**
 * Meeting data returned from API
 */
export interface MeetingResponse {
  id: string;
  title: string;
  platform?: string | null;
  meetingUrl?: string | null;
  recordingUrl?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  durationSeconds?: number | null;
  status: string;
  botId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants?: Array<{
    id: string;
    name: string;
    email?: string | null;
    speakerLabel?: string | null;
    isHost: boolean;
  }>;
  hasTranscript?: boolean;
  hasSummary?: boolean;
}

export interface CreateMeetingData {
  organizationId: string;
  createdById?: string;
  title: string;
  platform?: string;
  meetingUrl?: string;
  startTime?: Date;
  endTime?: Date;
  calendarEventId?: string;
}

export interface UpdateMeetingData {
  title?: string;
  platform?: string;
  meetingUrl?: string;
  recordingUrl?: string;
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
  status?: string;
  botId?: string;
}

export interface ListMeetingsQuery {
  organizationId: string;
  page: number;
  limit: number;
  status?: string | string[];
  platform?: string;
  search?: string;
  startTimeFrom?: Date;
  startTimeTo?: Date;
}

export interface ListMeetingsResult {
  meetings: MeetingResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Service for meeting business logic
 */
export class MeetingService {
  /**
   * List meetings with pagination and optional filtering
   * @param query - Query parameters
   */
  async list(query: ListMeetingsQuery): Promise<ListMeetingsResult> {
    logger.debug({ query }, 'Listing meetings');

    const result = await meetingRepository.findManyPaginated(
      { page: query.page, limit: query.limit },
      {
        organizationId: query.organizationId,
        status: query.status,
        platform: query.platform,
        search: query.search,
        startTimeFrom: query.startTimeFrom,
        startTimeTo: query.startTimeTo,
      },
      { participants: true, transcript: true, summary: true }
    );

    const meetings = result.data.map((meeting) =>
      this.toMeetingResponse(meeting as MeetingWithRelations)
    );

    return {
      meetings,
      pagination: result.pagination,
    };
  }

  /**
   * Get upcoming meetings for an organization
   * @param organizationId - Organization ID
   * @param limit - Maximum number to return
   */
  async getUpcoming(organizationId: string, limit = 10): Promise<MeetingResponse[]> {
    logger.debug({ organizationId, limit }, 'Getting upcoming meetings');

    const meetings = await meetingRepository.findUpcoming(organizationId, limit);
    return meetings.map((m) => this.toMeetingResponse(m));
  }

  /**
   * Get recent completed meetings for an organization
   * @param organizationId - Organization ID
   * @param limit - Maximum number to return
   */
  async getRecentCompleted(
    organizationId: string,
    limit = 10
  ): Promise<MeetingResponse[]> {
    logger.debug({ organizationId, limit }, 'Getting recent completed meetings');

    const meetings = await meetingRepository.findRecentCompleted(
      organizationId,
      limit
    );
    return meetings.map((m) => this.toMeetingResponse(m as MeetingWithRelations));
  }

  /**
   * Get a meeting by ID
   * @param id - Meeting ID
   * @param organizationId - Organization ID (for access control)
   */
  async getById(id: string, organizationId: string): Promise<MeetingResponse> {
    logger.debug({ id, organizationId }, 'Getting meeting by ID');

    const meeting = await meetingRepository.findById(id, {
      participants: true,
      transcript: true,
      summary: true,
      actionItems: true,
    });

    if (!meeting) {
      throw errors.notFound('Meeting');
    }

    // Verify organization access
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    return this.toMeetingResponse(meeting as MeetingWithRelations);
  }

  /**
   * Create a new meeting
   * @param data - Meeting data
   */
  async create(data: CreateMeetingData): Promise<MeetingResponse> {
    logger.debug({ data }, 'Creating meeting');

    const meeting = await meetingRepository.create(data, {
      participants: true,
    });

    logger.info({ meetingId: meeting.id }, 'Meeting created');

    return this.toMeetingResponse(meeting);
  }

  /**
   * Update a meeting
   * @param id - Meeting ID
   * @param organizationId - Organization ID (for access control)
   * @param data - Update data
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateMeetingData
  ): Promise<MeetingResponse> {
    logger.debug({ id, data }, 'Updating meeting');

    // Verify access
    const existing = await meetingRepository.findById(id);
    if (!existing) {
      throw errors.notFound('Meeting');
    }
    if (existing.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    const meeting = await meetingRepository.update(id, data, {
      participants: true,
    });

    logger.info({ meetingId: meeting.id }, 'Meeting updated');

    return this.toMeetingResponse(meeting);
  }

  /**
   * Update meeting status
   * @param id - Meeting ID
   * @param organizationId - Organization ID (for access control)
   * @param status - New status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: string
  ): Promise<MeetingResponse> {
    logger.debug({ id, status }, 'Updating meeting status');

    // Verify access
    const existing = await meetingRepository.findById(id);
    if (!existing) {
      throw errors.notFound('Meeting');
    }
    if (existing.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    const meeting = await meetingRepository.updateStatus(id, status);

    logger.info({ meetingId: meeting.id, status }, 'Meeting status updated');

    return this.toMeetingResponse(meeting);
  }

  /**
   * Delete a meeting (soft delete)
   * @param id - Meeting ID
   * @param organizationId - Organization ID (for access control)
   */
  async delete(id: string, organizationId: string): Promise<void> {
    logger.debug({ id }, 'Deleting meeting');

    const meeting = await meetingRepository.findById(id);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    await meetingRepository.softDelete(id);
    logger.info({ meetingId: id }, 'Meeting deleted');
  }

  /**
   * Get meeting statistics for an organization
   * @param organizationId - Organization ID
   */
  async getStats(organizationId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalDuration: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    logger.debug({ organizationId }, 'Getting meeting stats');
    return meetingRepository.getStats(organizationId);
  }

  /**
   * Get transcript for a meeting
   * @param meetingId - Meeting ID
   * @param organizationId - Organization ID (for access control)
   */
  async getTranscript(
    meetingId: string,
    organizationId: string
  ): Promise<Transcript | null> {
    logger.debug({ meetingId }, 'Getting meeting transcript');

    // Verify access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    return transcriptRepository.findByMeetingId(meetingId);
  }

  /**
   * Get summary for a meeting
   * @param meetingId - Meeting ID
   * @param organizationId - Organization ID (for access control)
   */
  async getSummary(
    meetingId: string,
    organizationId: string
  ): Promise<Summary | null> {
    logger.debug({ meetingId }, 'Getting meeting summary');

    // Verify access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    return transcriptRepository.findSummaryByMeetingId(meetingId);
  }

  /**
   * Get action items for a meeting
   * @param meetingId - Meeting ID
   * @param organizationId - Organization ID (for access control)
   */
  async getActionItems(
    meetingId: string,
    organizationId: string
  ): Promise<ActionItem[]> {
    logger.debug({ meetingId }, 'Getting meeting action items');

    // Verify access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    return transcriptRepository.findActionItemsByMeetingId(meetingId);
  }

  /**
   * Converts a database meeting to API response format
   */
  private toMeetingResponse(meeting: MeetingWithRelations): MeetingResponse {
    return {
      id: meeting.id,
      title: meeting.title,
      platform: meeting.platform,
      meetingUrl: meeting.meetingUrl,
      recordingUrl: meeting.recordingUrl,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      durationSeconds: meeting.durationSeconds,
      status: meeting.status,
      botId: meeting.botId,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      participants: meeting.participants?.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        speakerLabel: p.speakerLabel,
        isHost: p.isHost,
      })),
      hasTranscript: !!meeting.transcript,
      hasSummary: !!meeting.summary,
    };
  }
}

/**
 * Meeting with optional relations
 */
interface MeetingWithRelations extends Meeting {
  participants?: Array<{
    id: string;
    name: string;
    email: string | null;
    speakerLabel: string | null;
    isHost: boolean;
  }>;
  transcript?: { id: string } | null;
  summary?: { id: string } | null;
  actionItems?: ActionItem[];
}

// Export singleton instance
export const meetingService = new MeetingService();
