/**
 * @ownership
 * @domain Meeting AI Chat
 * @description RAG-powered chat service for Q&A over meeting transcripts
 * @single-responsibility YES — handles all AI chat operations
 * @last-reviewed 2026-01-06
 */

// Use dynamic imports for optional AI SDK dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Anthropic: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let OpenAI: any = null;

// Try to import SDKs dynamically
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  // Anthropic SDK not available
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  OpenAI = require('openai').default;
} catch {
  // OpenAI SDK not available
}

import { prisma } from '@zigznote/database';
import { createLogger } from '@zigznote/shared';
import { embeddingService } from './embeddingService';
import { apiKeyProvider, ApiProviders } from './apiKeyProvider';

const logger = createLogger({ component: 'meetingChatService' });

// AI client instances (lazy initialized)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anthropicClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openaiClient: any = null;

/**
 * Get or create Anthropic client
 */
async function getAnthropicClient(): Promise<typeof anthropicClient> {
  if (!Anthropic) return null;

  const apiKey = await apiKeyProvider.getKey(ApiProviders.ANTHROPIC);
  if (!apiKey) return null;

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Get or create OpenAI client
 */
async function getOpenAIClient(): Promise<typeof openaiClient> {
  if (!OpenAI) return null;

  const apiKey = await apiKeyProvider.getKey(ApiProviders.OPENAI);
  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const FALLBACK_MODEL = 'gpt-4o-mini';
const MAX_CONTEXT_CHUNKS = 8;
const MAX_HISTORY_MESSAGES = 10;

export interface Citation {
  meetingId: string;
  meetingTitle: string;
  timestamp: number | null;
  text: string;
  speaker?: string;
  relevance: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  model?: string;
  tokens?: number;
  latencyMs?: number;
  createdAt: Date;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestedFollowups?: string[];
}

export interface CreateChatOptions {
  organizationId: string;
  userId: string;
  meetingId?: string; // null for cross-meeting chat
  title?: string;
}

export interface SendMessageOptions {
  chatId: string;
  userId: string;
  organizationId: string;
  message: string;
  meetingId?: string; // For single-meeting context
}

export class MeetingChatService {
  /**
   * Create a new chat session
   */
  async createChat(options: CreateChatOptions): Promise<string> {
    const { organizationId, userId, meetingId, title } = options;

    const chat = await prisma.meetingChat.create({
      data: {
        organizationId,
        userId,
        meetingId,
        title: title || (meetingId ? 'Chat about meeting' : 'Search across meetings'),
      },
    });

    logger.info({ chatId: chat.id, meetingId }, 'Created chat session');
    return chat.id;
  }

  /**
   * Get chat history
   */
  async getChatHistory(
    chatId: string,
    userId: string
  ): Promise<ChatMessage[]> {
    const chat = await prisma.meetingChat.findFirst({
      where: { id: chatId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    return chat.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      citations: m.citations as unknown as Citation[] | undefined,
      model: m.model || undefined,
      tokens: m.tokens || undefined,
      latencyMs: m.latencyMs || undefined,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(options: SendMessageOptions): Promise<ChatResponse> {
    const { chatId, userId, organizationId, message, meetingId } = options;
    const startTime = Date.now();

    // Verify chat exists and belongs to user
    const chat = await prisma.meetingChat.findFirst({
      where: { id: chatId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: MAX_HISTORY_MESSAGES,
        },
        meeting: meetingId
          ? {
              include: {
                transcript: true,
                summary: true,
              },
            }
          : undefined,
      },
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    // Store user message
    await prisma.chatMessage.create({
      data: {
        chatId,
        role: 'user',
        content: message,
      },
    });

    try {
      // Get relevant context chunks
      let contextChunks: Array<{
        meetingId: string;
        meetingTitle: string;
        text: string;
        startTime: number | null;
        speakers: string[] | null;
        similarity: number;
      }> = [];

      if (meetingId || chat.meetingId) {
        // Single meeting context
        const targetMeetingId = meetingId || chat.meetingId!;
        const chunks = await embeddingService.getContextChunks(
          targetMeetingId,
          message,
          MAX_CONTEXT_CHUNKS
        );

        const meetingTitle = chat.meeting?.title || 'Meeting';
        contextChunks = chunks.map((c) => ({
          meetingId: targetMeetingId,
          meetingTitle,
          text: c.text,
          startTime: c.startTime,
          speakers: c.speakers,
          similarity: c.similarity,
        }));
      } else {
        // Cross-meeting search
        contextChunks = await embeddingService.crossMeetingSearch(
          organizationId,
          message,
          { limit: MAX_CONTEXT_CHUNKS }
        );
      }

      // Build context for AI
      const meetingWithSummary = chat.meeting as { title: string; summary?: { content: unknown } | null } | null;
      const meetingContext = meetingWithSummary ? {
        title: meetingWithSummary.title,
        summary: meetingWithSummary.summary ? { content: String(meetingWithSummary.summary.content) } : null,
      } : null;
      const context = this.buildContext(contextChunks, meetingContext);
      const history = chat.messages.reverse().slice(0, MAX_HISTORY_MESSAGES);

      // Generate response
      const { response, model, tokens } = await this.generateResponse(
        message,
        context,
        history.map((m) => ({ role: m.role, content: m.content }))
      );

      // Build citations
      const citations: Citation[] = contextChunks.map((chunk) => ({
        meetingId: chunk.meetingId,
        meetingTitle: chunk.meetingTitle,
        timestamp: chunk.startTime,
        text: chunk.text.substring(0, 200),
        speaker: chunk.speakers?.[0],
        relevance: chunk.similarity,
      }));

      const latencyMs = Date.now() - startTime;

      // Store assistant message
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          chatId,
          role: 'assistant',
          content: response,
          citations: citations.length > 0 ? JSON.parse(JSON.stringify(citations)) : undefined,
          model,
          tokens,
          latencyMs,
        },
      });

      // Generate suggested follow-ups
      const suggestedFollowups = await this.generateSuggestedQuestions(
        message,
        response,
        contextChunks
      );

      logger.info({
        chatId,
        model,
        tokens,
        latencyMs,
        citationCount: citations.length,
      }, 'Chat message processed');

      return {
        message: {
          id: assistantMessage.id,
          role: 'assistant',
          content: response,
          citations,
          model,
          tokens,
          latencyMs,
          createdAt: assistantMessage.createdAt,
        },
        suggestedFollowups,
      };
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to process chat message');
      throw error;
    }
  }

  /**
   * Build context string for AI from chunks
   */
  private buildContext(
    chunks: Array<{
      meetingId: string;
      meetingTitle: string;
      text: string;
      startTime: number | null;
      speakers: string[] | null;
    }>,
    meeting?: {
      title: string;
      summary: { content: string } | null;
    } | null
  ): string {
    let context = '';

    // Add meeting summary if available
    if (meeting?.summary?.content) {
      context += `## Meeting Summary: ${meeting.title}\n${meeting.summary.content}\n\n`;
    }

    // Add relevant transcript chunks
    if (chunks.length > 0) {
      context += '## Relevant Transcript Excerpts\n\n';

      for (const chunk of chunks) {
        const timestamp = chunk.startTime
          ? `[${Math.floor(chunk.startTime / 60)}:${String(chunk.startTime % 60).padStart(2, '0')}]`
          : '';
        const speaker = chunk.speakers?.[0] ? `${chunk.speakers[0]}: ` : '';

        context += `**${chunk.meetingTitle}** ${timestamp}\n`;
        context += `${speaker}${chunk.text}\n\n`;
      }
    }

    return context;
  }

  /**
   * Generate AI response using Claude or GPT
   */
  private async generateResponse(
    userMessage: string,
    context: string,
    history: Array<{ role: string; content: string }>
  ): Promise<{ response: string; model: string; tokens: number }> {
    const systemPrompt = `You are a helpful AI assistant that answers questions about meeting transcripts and notes.

INSTRUCTIONS:
1. Answer questions based ONLY on the provided meeting context
2. If the answer is not in the context, say "I don't see information about that in the meeting transcript"
3. Be concise and direct
4. When citing specific information, reference the meeting title and timestamp if available
5. If asked about action items, decisions, or key points, summarize them clearly

CONTEXT:
${context}`;

    // Try Claude first
    const anthropic = await getAnthropicClient();
    if (anthropic) {
      try {
        const messages = [
          ...history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: userMessage },
        ];

        const response = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        const content = response.content[0];
        const text = content.type === 'text' ? content.text : '';

        return {
          response: text,
          model: DEFAULT_MODEL,
          tokens: response.usage.input_tokens + response.usage.output_tokens,
        };
      } catch (error) {
        logger.warn({ error }, 'Claude API failed, falling back to GPT');
      }
    }

    // Fallback to GPT
    const openai = await getOpenAIClient();
    if (openai) {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ];

      const response = await openai.chat.completions.create({
        model: FALLBACK_MODEL,
        max_tokens: 1024,
        messages,
      });

      return {
        response: response.choices[0].message.content || '',
        model: FALLBACK_MODEL,
        tokens: response.usage?.total_tokens || 0,
      };
    }

    throw new Error('No AI provider available');
  }

  /**
   * Generate suggested follow-up questions
   */
  private async generateSuggestedQuestions(
    userMessage: string,
    response: string,
    _chunks: Array<{ text: string }>
  ): Promise<string[]> {
    // Simple heuristic-based suggestions
    const suggestions: string[] = [];

    if (response.toLowerCase().includes('action item')) {
      suggestions.push('Who is responsible for each action item?');
    }
    if (response.toLowerCase().includes('decision')) {
      suggestions.push('What were the main factors in this decision?');
    }
    if (response.toLowerCase().includes('next step')) {
      suggestions.push('When are these next steps due?');
    }
    if (!userMessage.toLowerCase().includes('summary')) {
      suggestions.push('Can you give me a quick summary?');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get chats for a user
   */
  async getUserChats(
    userId: string,
    organizationId: string,
    options: { meetingId?: string; limit?: number } = {}
  ): Promise<Array<{
    id: string;
    title: string | null;
    meetingId: string | null;
    messageCount: number;
    lastMessageAt: Date;
  }>> {
    const { meetingId, limit = 20 } = options;

    const chats = await prisma.meetingChat.findMany({
      where: {
        userId,
        organizationId,
        ...(meetingId ? { meetingId } : {}),
      },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      meetingId: chat.meetingId,
      messageCount: chat._count.messages,
      lastMessageAt: chat.messages[0]?.createdAt || chat.createdAt,
    }));
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: string, userId: string): Promise<void> {
    await prisma.meetingChat.deleteMany({
      where: { id: chatId, userId },
    });

    logger.info({ chatId }, 'Deleted chat');
  }

  /**
   * Generate suggested questions for a meeting
   */
  async generateMeetingSuggestions(meetingId: string): Promise<string[]> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        summary: true,
        actionItems: { take: 5 },
      },
    });

    if (!meeting) {
      return [];
    }

    const suggestions: string[] = [];

    // Based on meeting content
    if (meeting.actionItems.length > 0) {
      suggestions.push('What are the action items from this meeting?');
      suggestions.push('Who is responsible for each task?');
    }

    if (meeting.summary) {
      suggestions.push('What were the main decisions made?');
      suggestions.push('What topics were discussed?');
    }

    suggestions.push('Can you summarize this meeting in 30 seconds?');
    suggestions.push('What are the key takeaways?');

    // Store suggestions in database
    if (suggestions.length > 0) {
      await prisma.suggestedQuestion.deleteMany({
        where: { meetingId },
      });

      await prisma.suggestedQuestion.createMany({
        data: suggestions.map((question, index) => ({
          meetingId,
          question,
          category: index < 2 ? 'action_items' : 'key_points',
          priority: suggestions.length - index,
        })),
      });
    }

    return suggestions;
  }

  /**
   * Get suggested questions for a meeting
   */
  async getMeetingSuggestions(meetingId: string): Promise<string[]> {
    const suggestions = await prisma.suggestedQuestion.findMany({
      where: { meetingId },
      orderBy: { priority: 'desc' },
      take: 6,
    });

    if (suggestions.length === 0) {
      return this.generateMeetingSuggestions(meetingId);
    }

    return suggestions.map((s) => s.question);
  }
}

export const meetingChatService = new MeetingChatService();
