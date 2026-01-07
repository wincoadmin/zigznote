/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for managing annotations (highlights, labels) on transcript segments
 * @single-responsibility YES - handles all annotation operations
 * @last-reviewed 2026-01-07
 */

import { prisma, AnnotationLabel } from '@zigznote/database';
import { logger } from '../utils/logger';
import { errors } from '../utils/errors';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import { realtimeService } from './realtimeService';

/**
 * Annotation with user details
 */
export interface AnnotationWithUser {
  id: string;
  meetingId: string;
  userId: string;
  startTime: number;
  endTime: number;
  segmentIds: string[];
  text: string | null;
  label: AnnotationLabel;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export interface CreateAnnotationData {
  meetingId: string;
  userId: string;
  startTime: number;
  endTime: number;
  segmentIds: string[];
  text?: string;
  label?: AnnotationLabel;
  color?: string;
}

export interface UpdateAnnotationData {
  text?: string;
  label?: AnnotationLabel;
  color?: string;
}

/**
 * Label colors for consistent UI
 */
export const LABEL_COLORS: Record<AnnotationLabel, string> = {
  HIGHLIGHT: '#FEF3C7', // Yellow
  ACTION_ITEM: '#DBEAFE', // Blue
  DECISION: '#D1FAE5', // Green
  QUESTION: '#FCE7F3', // Pink
  IMPORTANT: '#FEE2E2', // Red
  FOLLOW_UP: '#E0E7FF', // Indigo
  BLOCKER: '#FED7AA', // Orange
  IDEA: '#DDD6FE', // Purple
};

/**
 * Service for annotation operations
 */
export class AnnotationService {
  /**
   * Get all annotations for a meeting
   */
  async getAnnotations(
    meetingId: string,
    options: {
      label?: AnnotationLabel;
      userId?: string;
    } = {}
  ): Promise<AnnotationWithUser[]> {
    const where: Record<string, unknown> = { meetingId };

    if (options.label) {
      where.label = options.label;
    }

    if (options.userId) {
      where.userId = options.userId;
    }

    const annotations = await prisma.annotation.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return annotations as AnnotationWithUser[];
  }

  /**
   * Get annotations for a specific time range
   */
  async getAnnotationsInRange(
    meetingId: string,
    startTime: number,
    endTime: number
  ): Promise<AnnotationWithUser[]> {
    const annotations = await prisma.annotation.findMany({
      where: {
        meetingId,
        OR: [
          // Annotation starts within range
          {
            startTime: { gte: startTime, lte: endTime },
          },
          // Annotation ends within range
          {
            endTime: { gte: startTime, lte: endTime },
          },
          // Annotation spans the entire range
          {
            startTime: { lte: startTime },
            endTime: { gte: endTime },
          },
        ],
      },
      orderBy: { startTime: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return annotations as AnnotationWithUser[];
  }

  /**
   * Get a single annotation by ID
   */
  async getById(annotationId: string): Promise<AnnotationWithUser | null> {
    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return annotation as AnnotationWithUser | null;
  }

  /**
   * Create a new annotation
   */
  async create(data: CreateAnnotationData): Promise<AnnotationWithUser> {
    logger.debug({ meetingId: data.meetingId, userId: data.userId }, 'Creating annotation');

    // Validate time range
    if (data.startTime >= data.endTime) {
      throw errors.badRequest('End time must be after start time');
    }

    const annotation = await prisma.annotation.create({
      data: {
        meetingId: data.meetingId,
        userId: data.userId,
        startTime: data.startTime,
        endTime: data.endTime,
        segmentIds: data.segmentIds,
        text: data.text,
        label: data.label || 'HIGHLIGHT',
        color: data.color || LABEL_COLORS[data.label || 'HIGHLIGHT'],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get meeting for activity logging
    const meeting = await prisma.meeting.findUnique({
      where: { id: data.meetingId },
      select: { organizationId: true, createdById: true, title: true },
    });

    if (meeting) {
      // Log activity
      await activityService.log({
        userId: data.userId,
        organizationId: meeting.organizationId,
        action: 'ANNOTATION_ADDED',
        meetingId: data.meetingId,
        annotationId: annotation.id,
        metadata: {
          label: annotation.label,
          startTime: annotation.startTime,
          endTime: annotation.endTime,
        },
      });

      // Notify meeting owner if it's not their annotation
      if (meeting.createdById && meeting.createdById !== data.userId) {
        await notificationService.create({
          userId: meeting.createdById,
          type: 'ANNOTATION_ADDED',
          title: `New ${annotation.label.toLowerCase().replace('_', ' ')} on your meeting`,
          message: `Someone added a ${annotation.label.toLowerCase().replace('_', ' ')} to "${meeting.title}"`,
          meetingId: data.meetingId,
          metadata: {
            annotationId: annotation.id,
            label: annotation.label,
            annotatedBy: data.userId,
          },
        });
      }

      // Broadcast real-time update
      realtimeService.broadcastToMeeting(data.meetingId, 'annotation:created', {
        annotation,
      });
    }

    logger.info({ annotationId: annotation.id, meetingId: data.meetingId }, 'Annotation created');
    return annotation as AnnotationWithUser;
  }

  /**
   * Update an annotation
   */
  async update(
    annotationId: string,
    userId: string,
    data: UpdateAnnotationData
  ): Promise<AnnotationWithUser> {
    logger.debug({ annotationId, userId }, 'Updating annotation');

    // Verify ownership
    const existing = await prisma.annotation.findUnique({
      where: { id: annotationId },
      select: { userId: true, meetingId: true },
    });

    if (!existing) {
      throw errors.notFound('Annotation');
    }

    if (existing.userId !== userId) {
      throw errors.forbidden('You can only edit your own annotations');
    }

    // Update color if label changed
    const updateData: Record<string, unknown> = { ...data };
    if (data.label && !data.color) {
      updateData.color = LABEL_COLORS[data.label];
    }

    const annotation = await prisma.annotation.update({
      where: { id: annotationId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get meeting for activity logging
    const meeting = await prisma.meeting.findUnique({
      where: { id: existing.meetingId },
      select: { organizationId: true },
    });

    if (meeting) {
      await activityService.log({
        userId,
        organizationId: meeting.organizationId,
        action: 'ANNOTATION_UPDATED',
        meetingId: existing.meetingId,
        annotationId,
        metadata: {
          label: annotation.label,
          changes: Object.keys(data),
        },
      });
    }

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(existing.meetingId, 'annotation:updated', {
      annotation,
    });

    logger.info({ annotationId }, 'Annotation updated');
    return annotation as AnnotationWithUser;
  }

  /**
   * Delete an annotation
   */
  async delete(annotationId: string, userId: string): Promise<void> {
    logger.debug({ annotationId, userId }, 'Deleting annotation');

    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
      select: { userId: true, meetingId: true },
    });

    if (!annotation) {
      throw errors.notFound('Annotation');
    }

    if (annotation.userId !== userId) {
      throw errors.forbidden('You can only delete your own annotations');
    }

    await prisma.annotation.delete({
      where: { id: annotationId },
    });

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(annotation.meetingId, 'annotation:deleted', {
      annotationId,
    });

    logger.info({ annotationId }, 'Annotation deleted');
  }

  /**
   * Get annotation statistics for a meeting
   */
  async getStats(meetingId: string): Promise<{
    total: number;
    byLabel: Record<AnnotationLabel, number>;
    byUser: Array<{ userId: string; name: string | null; count: number }>;
  }> {
    const annotations = await prisma.annotation.findMany({
      where: { meetingId },
      select: {
        label: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    // Count by label
    const byLabel = {} as Record<AnnotationLabel, number>;
    for (const a of annotations) {
      byLabel[a.label] = (byLabel[a.label] || 0) + 1;
    }

    // Count by user
    const userCounts = new Map<string, { name: string | null; count: number }>();
    for (const a of annotations) {
      const existing = userCounts.get(a.userId);
      if (existing) {
        existing.count++;
      } else {
        userCounts.set(a.userId, { name: a.user.name, count: 1 });
      }
    }

    const byUser = Array.from(userCounts.entries()).map(([userId, data]) => ({
      userId,
      ...data,
    }));

    return {
      total: annotations.length,
      byLabel,
      byUser,
    };
  }

  /**
   * Get available label options for UI
   */
  getLabels(): Array<{ value: AnnotationLabel; label: string; color: string }> {
    return [
      { value: 'HIGHLIGHT', label: 'Highlight', color: LABEL_COLORS.HIGHLIGHT },
      { value: 'ACTION_ITEM', label: 'Action Item', color: LABEL_COLORS.ACTION_ITEM },
      { value: 'DECISION', label: 'Decision', color: LABEL_COLORS.DECISION },
      { value: 'QUESTION', label: 'Question', color: LABEL_COLORS.QUESTION },
      { value: 'IMPORTANT', label: 'Important', color: LABEL_COLORS.IMPORTANT },
      { value: 'FOLLOW_UP', label: 'Follow Up', color: LABEL_COLORS.FOLLOW_UP },
      { value: 'BLOCKER', label: 'Blocker', color: LABEL_COLORS.BLOCKER },
      { value: 'IDEA', label: 'Idea', color: LABEL_COLORS.IDEA },
    ];
  }
}

export const annotationService = new AnnotationService();
