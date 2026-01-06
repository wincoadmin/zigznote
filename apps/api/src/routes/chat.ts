/**
 * @ownership
 * @domain Meeting AI Chat
 * @description API routes for AI-powered chat with meeting transcripts
 * @single-responsibility YES — handles all meeting chat API operations
 * @last-reviewed 2026-01-06
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { meetingChatService, embeddingService } from '../services';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';

const router: Router = Router();

// ============================================
// Schemas
// ============================================

const createChatSchema = {
  body: z.object({
    meetingId: z.string().uuid().optional(),
    title: z.string().max(200).optional(),
  }),
};

const sendMessageSchema = {
  body: z.object({
    message: z.string().min(1).max(2000),
  }),
  params: z.object({
    chatId: z.string().uuid(),
  }),
};

const getChatSchema = {
  params: z.object({
    chatId: z.string().uuid(),
  }),
};

const searchSchema = {
  body: z.object({
    query: z.string().min(1).max(500),
    meetingIds: z.array(z.string().uuid()).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
};

// ============================================
// Routes
// ============================================

/**
 * Create a new chat session
 * POST /api/v1/chat
 */
router.post(
  '/',
  validateRequest(createChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { meetingId, title } = req.body;

      const chatId = await meetingChatService.createChat({
        organizationId: authReq.auth!.organizationId,
        userId: authReq.auth!.userId,
        meetingId,
        title,
      });

      res.status(201).json({
        success: true,
        data: { chatId },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's chat sessions
 * GET /api/v1/chat
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { meetingId, limit } = req.query;

    const chats = await meetingChatService.getUserChats(
      authReq.auth!.userId,
      authReq.auth!.organizationId,
      {
        meetingId: meetingId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      }
    );

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get chat history
 * GET /api/v1/chat/:chatId
 */
router.get(
  '/:chatId',
  validateRequest(getChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;

      const messages = await meetingChatService.getChatHistory(
        req.params.chatId!,
        authReq.auth!.userId
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Send message to chat
 * POST /api/v1/chat/:chatId/messages
 */
router.post(
  '/:chatId/messages',
  validateRequest(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { message } = req.body;

      const response = await meetingChatService.sendMessage({
        chatId: req.params.chatId!,
        userId: authReq.auth!.userId,
        organizationId: authReq.auth!.organizationId,
        message,
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a chat
 * DELETE /api/v1/chat/:chatId
 */
router.delete(
  '/:chatId',
  validateRequest(getChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;

      await meetingChatService.deleteChat(req.params.chatId!, authReq.auth!.userId);

      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Cross-meeting semantic search
 * POST /api/v1/chat/search
 */
router.post(
  '/search',
  validateRequest(searchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { query, meetingIds, limit } = req.body;

      const results = await embeddingService.crossMeetingSearch(
        authReq.auth!.organizationId,
        query,
        { meetingIds, limit }
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get suggested questions for a meeting
 * GET /api/v1/chat/meetings/:meetingId/suggestions
 */
router.get(
  '/meetings/:meetingId/suggestions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const meetingId = req.params.meetingId!;

      // Verify meeting belongs to user's organization
      const { prisma } = await import('@zigznote/database');
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId: authReq.auth!.organizationId,
          deletedAt: null,
        },
      });
      if (!meeting) {
        res.status(404).json({ success: false, error: 'Meeting not found' });
        return;
      }

      const suggestions = await meetingChatService.getMeetingSuggestions(
        meetingId
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
