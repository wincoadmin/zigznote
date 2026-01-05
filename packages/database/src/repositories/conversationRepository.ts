/**
 * Conversation Repository
 * Manages AI meeting assistant Q&A conversations
 */

import { PrismaClient, Conversation, ConversationMessage } from '@prisma/client';

const prisma = new PrismaClient();

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export interface CreateConversationInput {
  meetingId: string;
  userId: string;
  organizationId: string;
  title?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  tokensUsed?: number;
  modelUsed?: string;
  latencyMs?: number;
  sources?: Array<{ segmentIndex: number; text: string; relevance: number }>;
}

export interface ConversationFilter {
  meetingId?: string;
  userId?: string;
  organizationId?: string;
}

export const conversationRepository = {
  /**
   * Create a new conversation
   */
  async create(input: CreateConversationInput): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        meetingId: input.meetingId,
        userId: input.userId,
        organizationId: input.organizationId,
        title: input.title,
      },
    });
  },

  /**
   * Find conversation by ID
   */
  async findById(id: string): Promise<ConversationWithMessages | null> {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  /**
   * Find conversations by meeting
   */
  async findByMeeting(
    meetingId: string,
    userId?: string
  ): Promise<Conversation[]> {
    return prisma.conversation.findMany({
      where: {
        meetingId,
        ...(userId && { userId }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Find conversations by user with pagination
   */
  async findByUser(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ conversations: ConversationWithMessages[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1, // Only get first message for preview
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({ where: { userId } }),
    ]);

    return { conversations, total };
  },

  /**
   * Add message to conversation
   */
  async addMessage(input: CreateMessageInput): Promise<ConversationMessage> {
    const [message] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          tokensUsed: input.tokensUsed,
          modelUsed: input.modelUsed,
          latencyMs: input.latencyMs,
          sources: input.sources ?? [],
        },
      }),
      // Update conversation's updatedAt and totalTokens
      prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          totalTokens: {
            increment: input.tokensUsed ?? 0,
          },
        },
      }),
    ]);

    return message;
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    return prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Update conversation title
   */
  async updateTitle(id: string, title: string): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: { title },
    });
  },

  /**
   * Delete conversation and all messages
   */
  async delete(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id },
    });
  },

  /**
   * Get conversation count for a meeting
   */
  async countByMeeting(meetingId: string): Promise<number> {
    return prisma.conversation.count({
      where: { meetingId },
    });
  },

  /**
   * Get recent conversations for dashboard
   */
  async getRecent(
    organizationId: string,
    limit: number = 10
  ): Promise<ConversationWithMessages[]> {
    return prisma.conversation.findMany({
      where: { organizationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  },
};

export type { Conversation, ConversationMessage };
