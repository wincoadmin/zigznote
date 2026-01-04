/**
 * @ownership
 * @domain Meeting Management
 * @description Core CRUD operations for meetings
 * @invariants Meetings must have organizationId and createdById
 * @split-plan Complex queries in meetingQueryRepository, stats in meetingStatsRepository
 * @last-reviewed 2026-01-04
 */

import type { Meeting, MeetingParticipant, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { CreateMeetingInput, UpdateMeetingInput } from '../types';

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
 * Repository for Meeting entity CRUD operations
 */
export class MeetingRepository {
  /**
   * Finds a meeting by ID
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
   */
  async findByBotId(botId: string, include?: MeetingInclude): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: { botId, deletedAt: null },
      include,
    });
  }

  /**
   * Finds a meeting by calendar event ID
   */
  async findByCalendarEventId(
    calendarEventId: string,
    include?: MeetingInclude
  ): Promise<Meeting | null> {
    return prisma.meeting.findFirst({
      where: { calendarEventId, deletedAt: null },
      include,
    });
  }

  /**
   * Creates a new meeting
   */
  async create(data: CreateMeetingInput, include?: MeetingInclude): Promise<Meeting> {
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
   */
  async update(id: string, data: UpdateMeetingInput, include?: MeetingInclude): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Updates meeting status
   */
  async updateStatus(id: string, status: string): Promise<Meeting> {
    const updateData: Prisma.MeetingUpdateInput = { status };

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
   */
  async softDelete(id: string): Promise<void> {
    await prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard deletes a meeting (permanent)
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.meeting.delete({ where: { id } });
  }

  /**
   * Restores a soft-deleted meeting
   */
  async restore(id: string): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Adds participants to a meeting
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

    return prisma.meetingParticipant.findMany({ where: { meetingId } });
  }

  /**
   * Gets participants for a meeting
   */
  async getParticipants(meetingId: string): Promise<MeetingParticipant[]> {
    return prisma.meetingParticipant.findMany({ where: { meetingId } });
  }
}

// Export singleton instance
export const meetingRepository = new MeetingRepository();

// Re-export from split repositories for backward compatibility
export { meetingQueryRepository, MeetingQueryRepository } from './meetingQueryRepository';
export { meetingStatsRepository, MeetingStatsRepository } from './meetingStatsRepository';
