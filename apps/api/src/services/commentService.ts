/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for managing comments on meetings/transcripts
 * @single-responsibility YES - handles all comment operations
 * @last-reviewed 2026-01-07
 */

import { prisma } from '@zigznote/database';
import { logger } from '../utils/logger';
import { errors, AppError } from '../utils/errors';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import { realtimeService } from './realtimeService';

/**
 * Comment with related data
 */
export interface CommentWithDetails {
  id: string;
  meetingId: string;
  userId: string;
  content: string;
  segmentId: string | null;
  timestamp: number | null;
  parentId: string | null;
  isEdited: boolean;
  isResolved: boolean;
  resolvedById: string | null;
  resolvedAt: Date | null;
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
  mentions: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  reactions: Array<{
    emoji: string;
    count: number;
    users: Array<{ id: string; name: string | null }>;
    hasReacted: boolean;
  }>;
  replyCount: number;
}

export interface CreateCommentData {
  meetingId: string;
  userId: string;
  content: string;
  segmentId?: string;
  timestamp?: number;
  parentId?: string;
  mentionedUserIds?: string[];
}

export interface UpdateCommentData {
  content: string;
  mentionedUserIds?: string[];
}

/**
 * Service for comment operations
 */
export class CommentService {
  /**
   * Get comments for a meeting
   */
  async getComments(
    meetingId: string,
    userId: string,
    options: {
      parentId?: string | null;
      segmentId?: string;
    } = {}
  ): Promise<CommentWithDetails[]> {
    const { parentId = null, segmentId } = options;

    const where: Record<string, unknown> = {
      meetingId,
      parentId,
    };

    if (segmentId) {
      where.segmentId = segmentId;
    }

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
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
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    // Transform to response format with aggregated reactions
    return comments.map((comment) => this.transformComment(comment, userId));
  }

  /**
   * Get a single comment by ID
   */
  async getById(commentId: string, userId: string): Promise<CommentWithDetails | null> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
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
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!comment) return null;
    return this.transformComment(comment, userId);
  }

  /**
   * Get replies to a comment
   */
  async getReplies(commentId: string, userId: string): Promise<CommentWithDetails[]> {
    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      orderBy: { createdAt: 'asc' },
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
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    return replies.map((reply) => this.transformComment(reply, userId));
  }

  /**
   * Create a new comment
   */
  async create(data: CreateCommentData): Promise<CommentWithDetails> {
    logger.debug({ meetingId: data.meetingId, userId: data.userId }, 'Creating comment');

    // Create comment with mentions in a transaction
    const comment = await prisma.$transaction(async (tx) => {
      // Create the comment
      const newComment = await tx.comment.create({
        data: {
          meetingId: data.meetingId,
          userId: data.userId,
          content: data.content,
          segmentId: data.segmentId,
          timestamp: data.timestamp,
          parentId: data.parentId,
        },
      });

      // Create mentions if specified
      if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
        await tx.commentMention.createMany({
          data: data.mentionedUserIds.map((userId) => ({
            commentId: newComment.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      return newComment;
    });

    // Fetch complete comment with relations
    const fullComment = await this.getById(comment.id, data.userId);
    if (!fullComment) {
      throw new AppError('Failed to create comment', 500, 'INTERNAL_ERROR');
    }

    // Get meeting for activity logging
    const meeting = await prisma.meeting.findUnique({
      where: { id: data.meetingId },
      select: { organizationId: true, createdById: true, title: true },
    });

    if (meeting) {
      // Log activity
      const action = data.parentId ? 'COMMENT_REPLIED' : 'COMMENT_ADDED';
      await activityService.log({
        userId: data.userId,
        organizationId: meeting.organizationId,
        action,
        meetingId: data.meetingId,
        commentId: comment.id,
        metadata: {
          content: data.content.substring(0, 100),
          segmentId: data.segmentId,
          parentId: data.parentId,
        },
      });

      // Send notifications for mentions
      if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
        for (const mentionedUserId of data.mentionedUserIds) {
          if (mentionedUserId !== data.userId) {
            await notificationService.create({
              userId: mentionedUserId,
              type: 'MENTION',
              title: 'You were mentioned in a comment',
              message: `${fullComment.user.name || fullComment.user.email} mentioned you in a comment on "${meeting.title}"`,
              meetingId: data.meetingId,
              commentId: comment.id,
              metadata: { mentionedBy: data.userId },
            });
          }
        }
      }

      // Send notification to parent comment author for replies
      if (data.parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: data.parentId },
          select: { userId: true },
        });

        if (parentComment && parentComment.userId !== data.userId) {
          await notificationService.create({
            userId: parentComment.userId,
            type: 'REPLY',
            title: 'New reply to your comment',
            message: `${fullComment.user.name || fullComment.user.email} replied to your comment on "${meeting.title}"`,
            meetingId: data.meetingId,
            commentId: comment.id,
            metadata: { repliedBy: data.userId, parentId: data.parentId },
          });
        }
      }

      // Notify meeting owner about new comments (if not the commenter)
      if (meeting.createdById && meeting.createdById !== data.userId && !data.parentId) {
        const owner = await prisma.user.findUnique({
          where: { id: meeting.createdById },
          select: { notifyOnComment: true },
        });

        if (owner?.notifyOnComment) {
          await notificationService.create({
            userId: meeting.createdById,
            type: 'COMMENT_ADDED',
            title: 'New comment on your meeting',
            message: `${fullComment.user.name || fullComment.user.email} commented on "${meeting.title}"`,
            meetingId: data.meetingId,
            commentId: comment.id,
            metadata: { commentedBy: data.userId },
          });
        }
      }

      // Broadcast real-time update
      realtimeService.broadcastToMeeting(data.meetingId, 'comment:created', {
        comment: fullComment,
      });
    }

    logger.info({ commentId: comment.id, meetingId: data.meetingId }, 'Comment created');
    return fullComment;
  }

  /**
   * Update a comment
   */
  async update(
    commentId: string,
    userId: string,
    data: UpdateCommentData
  ): Promise<CommentWithDetails> {
    logger.debug({ commentId, userId }, 'Updating comment');

    // Verify ownership
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, meetingId: true },
    });

    if (!existing) {
      throw errors.notFound('Comment');
    }

    if (existing.userId !== userId) {
      throw errors.forbidden('You can only edit your own comments');
    }

    // Update comment and mentions in transaction
    await prisma.$transaction(async (tx) => {
      // Update comment
      await tx.comment.update({
        where: { id: commentId },
        data: {
          content: data.content,
          isEdited: true,
        },
      });

      // Update mentions: delete old, create new
      if (data.mentionedUserIds !== undefined) {
        await tx.commentMention.deleteMany({
          where: { commentId },
        });

        if (data.mentionedUserIds.length > 0) {
          await tx.commentMention.createMany({
            data: data.mentionedUserIds.map((uid) => ({
              commentId,
              userId: uid,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await this.getById(commentId, userId);
    if (!updated) {
      throw new AppError('Failed to update comment', 500, 'INTERNAL_ERROR');
    }

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(existing.meetingId, 'comment:updated', {
      comment: updated,
    });

    logger.info({ commentId }, 'Comment updated');
    return updated;
  }

  /**
   * Delete a comment
   */
  async delete(commentId: string, userId: string): Promise<void> {
    logger.debug({ commentId, userId }, 'Deleting comment');

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, meetingId: true },
    });

    if (!comment) {
      throw errors.notFound('Comment');
    }

    if (comment.userId !== userId) {
      throw errors.forbidden('You can only delete your own comments');
    }

    // Delete comment and all related data (cascades)
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(comment.meetingId, 'comment:deleted', {
      commentId,
    });

    logger.info({ commentId }, 'Comment deleted');
  }

  /**
   * Resolve a comment thread
   */
  async resolve(commentId: string, userId: string): Promise<CommentWithDetails> {
    logger.debug({ commentId, userId }, 'Resolving comment');

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { meetingId: true, parentId: true },
    });

    if (!comment) {
      throw errors.notFound('Comment');
    }

    // Only top-level comments can be resolved
    if (comment.parentId) {
      throw errors.badRequest('Only top-level comments can be resolved');
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isResolved: true,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });

    const updated = await this.getById(commentId, userId);
    if (!updated) {
      throw new AppError('Failed to resolve comment', 500, 'INTERNAL_ERROR');
    }

    // Log activity
    const meeting = await prisma.meeting.findUnique({
      where: { id: comment.meetingId },
      select: { organizationId: true },
    });

    if (meeting) {
      await activityService.log({
        userId,
        organizationId: meeting.organizationId,
        action: 'COMMENT_RESOLVED',
        meetingId: comment.meetingId,
        commentId,
      });
    }

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(comment.meetingId, 'comment:resolved', {
      comment: updated,
    });

    logger.info({ commentId }, 'Comment resolved');
    return updated;
  }

  /**
   * Unresolve a comment thread
   */
  async unresolve(commentId: string, userId: string): Promise<CommentWithDetails> {
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isResolved: false,
        resolvedById: null,
        resolvedAt: null,
      },
    });

    const updated = await this.getById(commentId, userId);
    if (!updated) {
      throw new AppError('Failed to unresolve comment', 500, 'INTERNAL_ERROR');
    }

    realtimeService.broadcastToMeeting(updated.meetingId, 'comment:unresolved', {
      comment: updated,
    });

    return updated;
  }

  /**
   * Add a reaction to a comment
   */
  async addReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    logger.debug({ commentId, userId, emoji }, 'Adding reaction');

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { meetingId: true },
    });

    if (!comment) {
      throw errors.notFound('Comment');
    }

    await prisma.commentReaction.upsert({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
      create: {
        commentId,
        userId,
        emoji,
      },
      update: {},
    });

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(comment.meetingId, 'comment:reaction', {
      commentId,
      emoji,
      userId,
      action: 'added',
    });

    logger.info({ commentId, emoji }, 'Reaction added');
  }

  /**
   * Remove a reaction from a comment
   */
  async removeReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { meetingId: true },
    });

    if (!comment) {
      throw errors.notFound('Comment');
    }

    await prisma.commentReaction.deleteMany({
      where: {
        commentId,
        userId,
        emoji,
      },
    });

    // Broadcast real-time update
    realtimeService.broadcastToMeeting(comment.meetingId, 'comment:reaction', {
      commentId,
      emoji,
      userId,
      action: 'removed',
    });
  }

  /**
   * Transform database comment to response format
   */
  private transformComment(
    comment: any,
    currentUserId: string
  ): CommentWithDetails {
    // Aggregate reactions by emoji
    const reactionMap = new Map<string, { count: number; users: Array<{ id: string; name: string | null }>; hasReacted: boolean }>();

    for (const reaction of comment.reactions) {
      if (!reactionMap.has(reaction.emoji)) {
        reactionMap.set(reaction.emoji, { count: 0, users: [], hasReacted: false });
      }
      const entry = reactionMap.get(reaction.emoji)!;
      entry.count++;
      entry.users.push({ id: reaction.user.id, name: reaction.user.name });
      if (reaction.userId === currentUserId) {
        entry.hasReacted = true;
      }
    }

    const reactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }));

    return {
      ...comment,
      reactions,
      replyCount: comment._count?.replies || 0,
    };
  }
}

export const commentService = new CommentService();
