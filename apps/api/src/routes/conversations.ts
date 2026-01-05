/**
 * Conversations Routes
 * AI Meeting Assistant Q&A endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zigznote/database';
import { meetingQAService } from '../services/meetingQAService';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth';

const router: Router = Router();

// Validation schemas
const askQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  preferredModel: z.enum(['claude', 'gpt']).optional(),
});

// Reserved for future use
// @ts-expect-error - Reserved for future POST /conversations endpoint
const _createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

/**
 * POST /api/v1/meetings/:meetingId/ask
 * Ask a question about a meeting
 */
router.post(
  '/meetings/:meetingId/ask',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { meetingId } = req.params;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;

      if (!userId || !organizationId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate request body
      const parsed = askQuestionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Invalid request body');
      }

      const { question, conversationId, preferredModel } = parsed.data;

      // Verify meeting belongs to organization
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      // Get or create conversation
      let conversation;
      let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (conversationId) {
        // Get existing conversation
        conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            meetingId,
            userId,
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (!conversation) {
          throw new NotFoundError('Conversation');
        }

        // Build conversation history
        conversationHistory = conversation.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      } else {
        // Create new conversation
        const title = await meetingQAService.generateConversationTitle(question);
        conversation = await prisma.conversation.create({
          data: {
            meetingId: meetingId!,
            userId,
            organizationId,
            title,
          },
        });
      }

      // Ask the question
      const response = await meetingQAService.askQuestion(
        meetingId!,
        question,
        conversationHistory,
        preferredModel
      );

      // Save user message
      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: question,
        },
      });

      // Save assistant response
      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.answer,
          tokensUsed: response.tokensUsed,
          modelUsed: response.modelUsed,
          latencyMs: response.latencyMs,
          sources: response.sources as unknown as Prisma.InputJsonValue,
        },
      });

      // Update conversation token count
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          totalTokens: {
            increment: response.tokensUsed,
          },
        },
      });

      res.json({
        conversationId: conversation.id,
        answer: response.answer,
        sources: response.sources,
        tokensUsed: response.tokensUsed,
        modelUsed: response.modelUsed,
        latencyMs: response.latencyMs,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meetings/:meetingId/conversations
 * Get all conversations for a meeting
 */
router.get(
  '/meetings/:meetingId/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { meetingId } = req.params;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;

      if (!userId || !organizationId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Verify meeting belongs to organization
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      const conversations = await prisma.conversation.findMany({
        where: {
          meetingId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1, // Just get first message for preview
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({
        conversations: conversations.map((c) => ({
          id: c.id,
          title: c.title,
          preview: c.messages[0]?.content.substring(0, 100) || '',
          messageCount: c.messages.length,
          totalTokens: c.totalTokens,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/conversations/:conversationId
 * Get a conversation with all messages
 */
router.get(
  '/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { conversationId } = req.params;
      const userId = authReq.auth?.userId;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation');
      }

      res.json({
        id: conversation.id,
        meetingId: conversation.meetingId,
        title: conversation.title,
        totalTokens: conversation.totalTokens,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          modelUsed: m.modelUsed,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/conversations/:conversationId
 * Delete a conversation
 */
router.delete(
  '/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { conversationId } = req.params;
      const userId = authReq.auth?.userId;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation');
      }

      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meetings/:meetingId/suggestions
 * Get suggested questions for a meeting
 */
router.get(
  '/meetings/:meetingId/suggestions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { meetingId } = req.params;
      const organizationId = authReq.auth?.organizationId;

      if (!organizationId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Verify meeting belongs to organization
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      const suggestions = await meetingQAService.getSuggestedQuestions(meetingId!);

      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  }
);

export const conversationsRouter = router;
