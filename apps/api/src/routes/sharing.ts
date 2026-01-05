/**
 * Meeting Sharing API Routes
 * Allows users to share meetings with external recipients
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { AppError, emailService } from '@zigznote/shared';
import { randomBytes } from 'crypto';

export const sharingRouter = Router();

// Validation schemas
const createShareSchema = z.object({
  meetingId: z.string().uuid(),
  shareType: z.enum(['link', 'email']),
  accessLevel: z.enum(['view', 'comment']).default('view'),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  password: z.string().min(4).max(100).optional(),
  expiresInDays: z.number().min(1).max(30).optional(),
  maxViews: z.number().min(1).max(1000).optional(),
  includeTranscript: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeActionItems: z.boolean().default(true),
  includeRecording: z.boolean().default(false),
  message: z.string().max(500).optional(),
});

const updateShareSchema = z.object({
  accessLevel: z.enum(['view', 'comment']).optional(),
  password: z.string().min(4).max(100).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().min(1).max(1000).nullable().optional(),
  includeTranscript: z.boolean().optional(),
  includeSummary: z.boolean().optional(),
  includeActionItems: z.boolean().optional(),
  includeRecording: z.boolean().optional(),
});

/**
 * Generate a secure share token
 */
function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * GET /api/v1/sharing/meetings/:meetingId
 * List all shares for a meeting
 */
sharingRouter.get(
  '/meetings/:meetingId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { meetingId } = req.params;

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify user has access to this meeting
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
      });

      if (!meeting) {
        throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
      }

      const shares = await prisma.meetingShare.findMany({
        where: {
          meetingId,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sharedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.json({
        success: true,
        data: shares.map((share) => ({
          id: share.id,
          shareType: share.shareType,
          accessLevel: share.accessLevel,
          recipientEmail: share.recipientEmail,
          recipientName: share.recipientName,
          shareUrl: share.shareToken
            ? `${process.env.WEB_URL || 'https://app.zigznote.com'}/shared/${share.shareToken}`
            : null,
          hasPassword: !!share.password,
          expiresAt: share.expiresAt,
          maxViews: share.maxViews,
          viewCount: share.viewCount,
          includeTranscript: share.includeTranscript,
          includeSummary: share.includeSummary,
          includeActionItems: share.includeActionItems,
          includeRecording: share.includeRecording,
          message: share.message,
          sharedBy: share.sharedBy,
          createdAt: share.createdAt,
          lastAccessedAt: share.lastAccessedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/sharing
 * Create a new share
 */
sharingRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const validationResult = createShareSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      const data = validationResult.data;

      // Email shares require recipient email
      if (data.shareType === 'email' && !data.recipientEmail) {
        throw new AppError('Recipient email is required for email shares', 400, 'VALIDATION_ERROR');
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify user has access to this meeting
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: data.meetingId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
      });

      if (!meeting) {
        throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
      }

      // Generate share token for link shares
      const shareToken = data.shareType === 'link' ? generateShareToken() : null;

      // Calculate expiration date
      const expiresAt = data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Create the share
      const share = await prisma.meetingShare.create({
        data: {
          meetingId: data.meetingId,
          sharedById: user.id,
          shareType: data.shareType,
          accessLevel: data.accessLevel,
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          shareToken,
          password: data.password, // In production, this should be hashed
          expiresAt,
          maxViews: data.maxViews,
          includeTranscript: data.includeTranscript,
          includeSummary: data.includeSummary,
          includeActionItems: data.includeActionItems,
          includeRecording: data.includeRecording,
          message: data.message,
        },
      });

      const shareUrl = shareToken
        ? `${process.env.WEB_URL || 'https://app.zigznote.com'}/shared/${shareToken}`
        : null;

      // Send email notification for email shares
      if (data.shareType === 'email' && data.recipientEmail) {
        await emailService.send({
          to: data.recipientEmail,
          subject: `${user.name || user.email} shared a meeting with you`,
          template: 'meeting-shared',
          data: {
            recipientName: data.recipientName,
            senderName: user.name || user.email,
            meetingTitle: meeting.title,
            meetingDate: meeting.startTime?.toLocaleDateString() || 'Unknown date',
            message: data.message,
            shareUrl: shareUrl || '',
            expiresAt: expiresAt?.toLocaleDateString(),
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          id: share.id,
          shareType: share.shareType,
          accessLevel: share.accessLevel,
          shareUrl,
          recipientEmail: share.recipientEmail,
          hasPassword: !!share.password,
          expiresAt: share.expiresAt,
          maxViews: share.maxViews,
          createdAt: share.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/sharing/:shareId
 * Update a share
 */
sharingRouter.patch(
  '/:shareId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { shareId } = req.params;

      const validationResult = updateShareSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Find the share and verify ownership
      const share = await prisma.meetingShare.findFirst({
        where: {
          id: shareId,
          revokedAt: null,
        },
        include: {
          meeting: true,
        },
      });

      if (!share) {
        throw new AppError('Share not found', 404, 'SHARE_NOT_FOUND');
      }

      // Check if user owns the share or is in the same organization
      if (share.sharedById !== user.id && share.meeting.organizationId !== user.organizationId) {
        throw new AppError('Not authorized to update this share', 403, 'FORBIDDEN');
      }

      // Update the share
      const updateData: Record<string, unknown> = {};
      if (validationResult.data.accessLevel !== undefined) {
        updateData.accessLevel = validationResult.data.accessLevel;
      }
      if (validationResult.data.password !== undefined) {
        updateData.password = validationResult.data.password;
      }
      if (validationResult.data.expiresAt !== undefined) {
        updateData.expiresAt = validationResult.data.expiresAt
          ? new Date(validationResult.data.expiresAt)
          : null;
      }
      if (validationResult.data.maxViews !== undefined) {
        updateData.maxViews = validationResult.data.maxViews;
      }
      if (validationResult.data.includeTranscript !== undefined) {
        updateData.includeTranscript = validationResult.data.includeTranscript;
      }
      if (validationResult.data.includeSummary !== undefined) {
        updateData.includeSummary = validationResult.data.includeSummary;
      }
      if (validationResult.data.includeActionItems !== undefined) {
        updateData.includeActionItems = validationResult.data.includeActionItems;
      }
      if (validationResult.data.includeRecording !== undefined) {
        updateData.includeRecording = validationResult.data.includeRecording;
      }

      const updatedShare = await prisma.meetingShare.update({
        where: { id: shareId },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          id: updatedShare.id,
          accessLevel: updatedShare.accessLevel,
          hasPassword: !!updatedShare.password,
          expiresAt: updatedShare.expiresAt,
          maxViews: updatedShare.maxViews,
          includeTranscript: updatedShare.includeTranscript,
          includeSummary: updatedShare.includeSummary,
          includeActionItems: updatedShare.includeActionItems,
          includeRecording: updatedShare.includeRecording,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/sharing/:shareId
 * Revoke a share
 */
sharingRouter.delete(
  '/:shareId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { shareId } = req.params;

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Find the share and verify ownership
      const share = await prisma.meetingShare.findFirst({
        where: {
          id: shareId,
          revokedAt: null,
        },
        include: {
          meeting: true,
        },
      });

      if (!share) {
        throw new AppError('Share not found', 404, 'SHARE_NOT_FOUND');
      }

      // Check if user owns the share or is in the same organization
      if (share.sharedById !== user.id && share.meeting.organizationId !== user.organizationId) {
        throw new AppError('Not authorized to revoke this share', 403, 'FORBIDDEN');
      }

      // Revoke the share (soft delete)
      await prisma.meetingShare.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
      });

      res.json({
        success: true,
        message: 'Share revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/sharing/public/:token
 * Access a shared meeting (public endpoint, no auth required)
 */
sharingRouter.get(
  '/public/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const share = await prisma.meetingShare.findFirst({
        where: {
          shareToken: token,
          revokedAt: null,
        },
        include: {
          meeting: {
            include: {
              transcript: true,
              summary: true,
              actionItems: true,
            },
          },
          sharedBy: {
            select: { name: true, email: true },
          },
        },
      });

      if (!share) {
        throw new AppError('Share not found or has been revoked', 404, 'SHARE_NOT_FOUND');
      }

      // Check expiration
      if (share.expiresAt && new Date() > share.expiresAt) {
        throw new AppError('This share link has expired', 410, 'SHARE_EXPIRED');
      }

      // Check view limit
      if (share.maxViews && share.viewCount >= share.maxViews) {
        throw new AppError('This share link has reached its view limit', 410, 'SHARE_VIEW_LIMIT');
      }

      // Check password if set
      if (share.password) {
        if (!password || password !== share.password) {
          res.status(401).json({
            success: false,
            error: 'Password required',
            requiresPassword: true,
          });
          return;
        }
      }

      // Increment view count and update last accessed
      await prisma.meetingShare.update({
        where: { id: share.id },
        data: {
          viewCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      // Build response based on permissions
      const meeting = share.meeting;
      const response: Record<string, unknown> = {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        durationSeconds: meeting.durationSeconds,
        sharedBy: share.sharedBy.name || share.sharedBy.email,
        accessLevel: share.accessLevel,
      };

      if (share.includeTranscript && meeting.transcript) {
        response.transcript = {
          segments: meeting.transcript.segments,
          fullText: meeting.transcript.fullText,
          wordCount: meeting.transcript.wordCount,
        };
      }

      if (share.includeSummary && meeting.summary) {
        response.summary = meeting.summary.content;
      }

      if (share.includeActionItems) {
        response.actionItems = meeting.actionItems.map((item) => ({
          id: item.id,
          text: item.text,
          assignee: item.assignee,
          dueDate: item.dueDate,
          completed: item.completed,
        }));
      }

      if (share.includeRecording && meeting.recordingUrl) {
        response.recordingUrl = meeting.recordingUrl;
      }

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default sharingRouter;
