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
  prisma,
} from '@zigznote/database';
import type { Meeting, Transcript, Summary, ActionItem } from '@zigznote/database';
import { recallService } from './recallService';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '@zigznote/shared';
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

// Redis connection for job queue
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisConnection: Redis | null = null;
let summarizationQueue: Queue | null = null;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}

function getSummarizationQueue(): Queue {
  if (!summarizationQueue) {
    summarizationQueue = new Queue(QUEUE_NAMES.SUMMARIZATION, {
      connection: getRedisConnection(),
    });
  }
  return summarizationQueue;
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
   * Create a meeting with optional bot in an atomic transaction
   * If bot creation fails, the meeting creation is rolled back
   * @param data - Meeting data with optional bot flag
   */
  async createMeetingWithBot(data: CreateMeetingData & { startBot?: boolean; botName?: string }): Promise<MeetingResponse> {
    logger.debug({ data, startBot: data.startBot }, 'Creating meeting with optional bot');

    return prisma.$transaction(async (tx) => {
      // Create the meeting
      const meeting = await tx.meeting.create({
        data: {
          title: data.title,
          organizationId: data.organizationId,
          createdById: data.createdById,
          platform: data.platform,
          meetingUrl: data.meetingUrl,
          startTime: data.startTime,
          endTime: data.endTime,
          calendarEventId: data.calendarEventId,
          status: data.startBot ? 'pending' : 'scheduled',
        },
        include: {
          participants: true,
        },
      });

      // If bot requested and meeting URL exists, create bot
      if (data.startBot && data.meetingUrl) {
        try {
          const bot = await recallService.createBot({
            meetingId: meeting.id,
            organizationId: data.organizationId,
            meetingUrl: data.meetingUrl,
            botName: data.botName,
          });

          // Update meeting with bot info
          const updatedMeeting = await tx.meeting.update({
            where: { id: meeting.id },
            data: {
              botId: bot.id,
              status: 'joining',
            },
            include: {
              participants: true,
            },
          });

          logger.info({ meetingId: meeting.id, botId: bot.id }, 'Meeting created with bot');

          return this.toMeetingResponse(updatedMeeting as unknown as MeetingWithRelations);
        } catch (error) {
          // Log and re-throw to rollback the transaction
          logger.error({ meetingId: meeting.id, error }, 'Failed to create bot, rolling back meeting');
          throw error;
        }
      }

      logger.info({ meetingId: meeting.id }, 'Meeting created without bot');

      return this.toMeetingResponse(meeting as unknown as MeetingWithRelations);
    }, {
      maxWait: 5000, // 5s max wait to acquire lock
      timeout: 10000, // 10s max transaction duration
    });
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
   * Regenerate summary for a meeting
   * @param meetingId - Meeting ID
   * @param organizationId - Organization ID (for access control)
   * @param options - Optional parameters (model preference)
   */
  async regenerateSummary(
    meetingId: string,
    organizationId: string,
    options?: { forceModel?: 'claude' | 'gpt' }
  ): Promise<{ jobId: string; message: string }> {
    logger.debug({ meetingId, options }, 'Regenerating meeting summary');

    // Verify access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    // Check if transcript exists
    const transcript = await transcriptRepository.findByMeetingId(meetingId);
    if (!transcript) {
      throw errors.badRequest('No transcript available for this meeting');
    }

    // Queue summarization job
    const queue = getSummarizationQueue();
    const job = await queue.add('regenerate', {
      meetingId,
      transcriptId: transcript.id,
      forceModel: options?.forceModel,
    });

    logger.info({ meetingId, jobId: job.id }, 'Summary regeneration queued');

    return {
      jobId: job.id || 'unknown',
      message: 'Summary regeneration has been queued',
    };
  }

  /**
   * Update an action item
   * @param meetingId - Meeting ID
   * @param actionItemId - Action item ID
   * @param organizationId - Organization ID (for access control)
   * @param data - Update data
   */
  async updateActionItem(
    meetingId: string,
    actionItemId: string,
    organizationId: string,
    data: {
      text?: string;
      assignee?: string;
      dueDate?: Date;
      completed?: boolean;
    }
  ): Promise<ActionItem> {
    logger.debug({ meetingId, actionItemId, data }, 'Updating action item');

    // Verify meeting access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    // Verify action item exists and belongs to meeting
    const actionItem = await transcriptRepository.findActionItemById(actionItemId);
    if (!actionItem) {
      throw errors.notFound('Action item');
    }
    if (actionItem.meetingId !== meetingId) {
      throw errors.forbidden('Action item does not belong to this meeting');
    }

    // Update the action item
    const updated = await transcriptRepository.updateActionItem(actionItemId, data);

    logger.info({ actionItemId, completed: data.completed }, 'Action item updated');

    return updated;
  }

  /**
   * Delete an action item
   * @param meetingId - Meeting ID
   * @param actionItemId - Action item ID
   * @param organizationId - Organization ID (for access control)
   */
  async deleteActionItem(
    meetingId: string,
    actionItemId: string,
    organizationId: string
  ): Promise<void> {
    logger.debug({ meetingId, actionItemId }, 'Deleting action item');

    // Verify meeting access
    const meeting = await meetingRepository.findById(meetingId);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }
    if (meeting.organizationId !== organizationId) {
      throw errors.forbidden('Access denied to this meeting');
    }

    // Verify action item exists and belongs to meeting
    const actionItem = await transcriptRepository.findActionItemById(actionItemId);
    if (!actionItem) {
      throw errors.notFound('Action item');
    }
    if (actionItem.meetingId !== meetingId) {
      throw errors.forbidden('Action item does not belong to this meeting');
    }

    await transcriptRepository.deleteActionItem(actionItemId);

    logger.info({ actionItemId }, 'Action item deleted');
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
