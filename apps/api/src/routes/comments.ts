/**
 * @ownership
 * @domain Team Collaboration
 * @description API routes for comment operations
 * @single-responsibility YES - handles all comment endpoints
 * @last-reviewed 2026-01-07
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { commentService } from '../services/commentService';
import { meetingAccessService } from '../services/meetingAccessService';
import { requireAuth } from '../middleware/auth';
import { AppError } from '@zigznote/shared';

export const commentsRouter: RouterType = Router();

// Helper to extract auth from request
function getAuth(req: Request): { userId: string; organizationId: string } {
  const auth = (req as any).auth;
  const userId = auth?.userId as string | undefined;
  const organizationId = (auth?.organizationId || '') as string;

  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return { userId, organizationId };
}

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  segmentId: z.string().optional(),
  timestamp: z.number().optional(),
  parentId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

/**
 * GET /api/v1/meetings/:meetingId/comments
 * Get all comments for a meeting
 */
commentsRouter.get(
  '/meetings/:meetingId/comments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { segmentId, parentId } = req.query;
      const { userId, organizationId } = getAuth(req);

      // Check access
      const hasAccess = await meetingAccessService.canView(meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const comments = await commentService.getComments(meetingId, userId, {
        segmentId: segmentId as string | undefined,
        parentId: parentId === 'null' ? null : (parentId as string | undefined),
      });

      res.json({
        success: true,
        data: comments,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/comments/:commentId
 * Get a single comment
 */
commentsRouter.get(
  '/comments/:commentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId, organizationId } = getAuth(req);

      const comment = await commentService.getById(commentId, userId);
      if (!comment) {
        throw new AppError('Comment not found', 404, 'NOT_FOUND');
      }

      // Check access to the meeting
      const hasAccess = await meetingAccessService.canView(comment.meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/comments/:commentId/replies
 * Get replies to a comment
 */
commentsRouter.get(
  '/comments/:commentId/replies',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId, organizationId } = getAuth(req);

      const parentComment = await commentService.getById(commentId, userId);
      if (!parentComment) {
        throw new AppError('Comment not found', 404, 'NOT_FOUND');
      }

      // Check access
      const hasAccess = await meetingAccessService.canView(parentComment.meetingId, userId, organizationId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const replies = await commentService.getReplies(commentId, userId);

      res.json({
        success: true,
        data: replies,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meetings/:meetingId/comments
 * Create a new comment
 */
commentsRouter.post(
  '/meetings/:meetingId/comments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meetingId = req.params.meetingId!;
      const { userId, organizationId } = getAuth(req);

      // Check comment permission
      const canComment = await meetingAccessService.canComment(meetingId, userId, organizationId);
      if (!canComment) {
        throw new AppError('You do not have permission to comment on this meeting', 403, 'FORBIDDEN');
      }

      const validationResult = createCommentSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      const comment = await commentService.create({
        meetingId,
        userId,
        ...validationResult.data,
      });

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/comments/:commentId
 * Update a comment
 */
commentsRouter.patch(
  '/comments/:commentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId } = getAuth(req);

      const validationResult = updateCommentSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      const comment = await commentService.update(commentId, userId, validationResult.data);

      res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/comments/:commentId
 * Delete a comment
 */
commentsRouter.delete(
  '/comments/:commentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId } = getAuth(req);

      await commentService.delete(commentId, userId);

      res.json({
        success: true,
        message: 'Comment deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/comments/:commentId/resolve
 * Resolve a comment thread
 */
commentsRouter.post(
  '/comments/:commentId/resolve',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId } = getAuth(req);

      const comment = await commentService.resolve(commentId, userId);

      res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/comments/:commentId/unresolve
 * Unresolve a comment thread
 */
commentsRouter.post(
  '/comments/:commentId/unresolve',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId } = getAuth(req);

      const comment = await commentService.unresolve(commentId, userId);

      res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/comments/:commentId/reactions
 * Add a reaction to a comment
 */
commentsRouter.post(
  '/comments/:commentId/reactions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const { userId } = getAuth(req);

      const validationResult = reactionSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      await commentService.addReaction(commentId, userId, validationResult.data.emoji);

      res.json({
        success: true,
        message: 'Reaction added',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/comments/:commentId/reactions/:emoji
 * Remove a reaction from a comment
 */
commentsRouter.delete(
  '/comments/:commentId/reactions/:emoji',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId!;
      const emoji = req.params.emoji!;
      const { userId } = getAuth(req);

      await commentService.removeReaction(commentId, userId, emoji);

      res.json({
        success: true,
        message: 'Reaction removed',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default commentsRouter;
