import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { errors } from '../utils/errors';

/**
 * Meeting data structure
 */
export interface Meeting {
  id: string;
  title: string;
  platform?: 'zoom' | 'meet' | 'teams' | 'webex' | 'other';
  meetingUrl?: string;
  startTime?: string;
  endTime?: string;
  status: 'scheduled' | 'recording' | 'processing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingData {
  title: string;
  platform?: 'zoom' | 'meet' | 'teams' | 'webex' | 'other';
  meetingUrl?: string;
  startTime?: string;
  endTime?: string;
}

export interface ListMeetingsQuery {
  page: number;
  limit: number;
  status?: 'scheduled' | 'recording' | 'processing' | 'completed';
}

export interface ListMeetingsResult {
  meetings: Meeting[];
  total: number;
}

/**
 * Service for meeting business logic
 * In Phase 0, this uses in-memory storage
 * Will be replaced with database repository in Phase 1
 */
export class MeetingService {
  // Temporary in-memory storage for Phase 0
  private meetings: Map<string, Meeting> = new Map();

  /**
   * List meetings with pagination and optional filtering
   */
  async list(query: ListMeetingsQuery): Promise<ListMeetingsResult> {
    logger.debug({ query }, 'Listing meetings');

    let meetings = Array.from(this.meetings.values());

    // Filter by status if provided
    if (query.status) {
      meetings = meetings.filter((m) => m.status === query.status);
    }

    // Sort by creation date (newest first)
    meetings.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = meetings.length;
    const start = (query.page - 1) * query.limit;
    const paginatedMeetings = meetings.slice(start, start + query.limit);

    return {
      meetings: paginatedMeetings,
      total,
    };
  }

  /**
   * Get a meeting by ID
   */
  async getById(id: string): Promise<Meeting | null> {
    logger.debug({ id }, 'Getting meeting by ID');
    return this.meetings.get(id) || null;
  }

  /**
   * Create a new meeting
   */
  async create(data: CreateMeetingData): Promise<Meeting> {
    logger.debug({ data }, 'Creating meeting');

    const now = new Date().toISOString();
    const meeting: Meeting = {
      id: uuidv4(),
      title: data.title,
      platform: data.platform,
      meetingUrl: data.meetingUrl,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    };

    this.meetings.set(meeting.id, meeting);
    logger.info({ meetingId: meeting.id }, 'Meeting created');

    return meeting;
  }

  /**
   * Delete a meeting
   */
  async delete(id: string): Promise<void> {
    logger.debug({ id }, 'Deleting meeting');

    const meeting = this.meetings.get(id);
    if (!meeting) {
      throw errors.notFound('Meeting');
    }

    this.meetings.delete(id);
    logger.info({ meetingId: id }, 'Meeting deleted');
  }
}
