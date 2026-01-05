/**
 * Meeting Q&A Service
 * AI-powered question answering about meeting content
 */

import pino from 'pino';
import { prisma } from '@zigznote/database';
import { AI_MODELS } from '@zigznote/shared';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Types
interface TranscriptSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

interface SourceReference {
  segmentIndex: number;
  text: string;
  relevance: number;
  speaker?: string;
  timestamp?: number;
}

interface QAResponse {
  answer: string;
  sources: SourceReference[];
  tokensUsed: number;
  modelUsed: string;
  latencyMs: number;
}

interface ConversationContext {
  role: 'user' | 'assistant';
  content: string;
}

interface MeetingContext {
  title: string;
  date?: string;
  participants: string[];
  transcript: string;
  segments: TranscriptSegment[];
  summary?: {
    executiveSummary?: string;
    topics?: Array<{ title: string; summary: string }>;
    decisions?: string[];
    actionItems?: Array<{ text: string; assignee?: string }>;
  };
}

// System prompt for Q&A
const QA_SYSTEM_PROMPT = `You are an AI assistant helping users understand and get information from their meeting recordings. You have access to the full meeting transcript and summary.

Your role is to:
1. Answer questions accurately based on the meeting content
2. Cite specific parts of the transcript when relevant
3. Identify who said what when asked about speakers
4. Help find specific moments or topics discussed
5. Summarize specific sections on request
6. Clarify any confusing parts of the meeting

Guidelines:
- Only answer based on what's in the meeting content. Don't make up information.
- If something wasn't discussed, say so clearly.
- When quoting, be accurate but you can paraphrase for clarity.
- Include speaker names when relevant.
- Be concise but thorough.
- If the question is ambiguous, ask for clarification.

Format your responses in a clear, readable way. Use bullet points for lists.`;

// Anthropic client type
interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      temperature: number;
      system: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

// OpenAI client type
interface OpenAIClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        max_tokens: number;
        temperature: number;
        messages: Array<{ role: string; content: string }>;
      }): Promise<{
        choices: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens: number };
      }>;
    };
  };
}

/**
 * Meeting Q&A Service Class
 */
export class MeetingQAService {
  private anthropic: AnthropicClient | null = null;
  private openai: OpenAIClient | null = null;

  /**
   * Get Anthropic client
   */
  private async getAnthropicClient(): Promise<AnthropicClient> {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      // Dynamic import to avoid build-time dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Anthropic = require('@anthropic-ai/sdk').default;
      this.anthropic = new Anthropic({ apiKey }) as AnthropicClient;
    }
    return this.anthropic;
  }

  /**
   * Get OpenAI client
   */
  private async getOpenAIClient(): Promise<OpenAIClient> {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      // Dynamic import to avoid build-time dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const OpenAI = require('openai').default;
      this.openai = new OpenAI({ apiKey }) as unknown as OpenAIClient;
    }
    return this.openai;
  }

  /**
   * Build meeting context for the LLM
   */
  private buildMeetingContext(context: MeetingContext): string {
    const parts: string[] = [];

    // Meeting metadata
    parts.push(`# Meeting: ${context.title}`);
    if (context.date) {
      parts.push(`Date: ${context.date}`);
    }
    if (context.participants.length > 0) {
      parts.push(`Participants: ${context.participants.join(', ')}`);
    }
    parts.push('');

    // Summary if available
    if (context.summary) {
      parts.push('## Summary');
      if (context.summary.executiveSummary) {
        parts.push(context.summary.executiveSummary);
        parts.push('');
      }

      if (context.summary.decisions && context.summary.decisions.length > 0) {
        parts.push('### Key Decisions');
        context.summary.decisions.forEach((d) => parts.push(`- ${d}`));
        parts.push('');
      }

      if (context.summary.actionItems && context.summary.actionItems.length > 0) {
        parts.push('### Action Items');
        context.summary.actionItems.forEach((a) => {
          const assignee = a.assignee ? ` (${a.assignee})` : '';
          parts.push(`- ${a.text}${assignee}`);
        });
        parts.push('');
      }
    }

    // Full transcript
    parts.push('## Full Transcript');
    parts.push(context.transcript);

    return parts.join('\n');
  }

  /**
   * Build conversation messages for context
   */
  private buildConversationMessages(
    history: ConversationContext[],
    meetingContext: string,
    question: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // First user message includes the meeting context
    const firstUserMessage = history.length === 0;

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current question
    if (firstUserMessage) {
      // Include meeting context in first message
      messages.push({
        role: 'user',
        content: `Here is the meeting content:\n\n${meetingContext}\n\n---\n\nQuestion: ${question}`,
      });
    } else {
      messages.push({
        role: 'user',
        content: question,
      });
    }

    return messages;
  }

  /**
   * Find relevant transcript segments for sources
   */
  private findRelevantSegments(
    segments: TranscriptSegment[],
    answer: string,
    limit: number = 3
  ): SourceReference[] {
    // Simple keyword matching for now
    // Could be enhanced with embeddings for semantic search
    const answerWords = answer.toLowerCase().split(/\s+/);

    const scored = segments.map((segment, index) => {
      const segmentWords = segment.text.toLowerCase().split(/\s+/);
      let score = 0;

      for (const word of answerWords) {
        if (word.length > 3 && segmentWords.includes(word)) {
          score++;
        }
      }

      return {
        segmentIndex: index,
        text: segment.text,
        speaker: segment.speaker,
        timestamp: segment.startMs,
        relevance: score / Math.max(answerWords.length, 1),
      };
    });

    return scored
      .filter((s) => s.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Ask a question about a meeting
   */
  async askQuestion(
    meetingId: string,
    question: string,
    conversationHistory: ConversationContext[] = [],
    preferredModel?: 'claude' | 'gpt'
  ): Promise<QAResponse> {
    const startTime = Date.now();

    // Fetch meeting data
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: true,
        summary: true,
        participants: true,
      },
    });

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!meeting.transcript) {
      throw new Error('Meeting has no transcript');
    }

    // Parse transcript segments
    const segments = (meeting.transcript.segments as unknown as TranscriptSegment[]) || [];

    // Build meeting context
    const meetingContext: MeetingContext = {
      title: meeting.title,
      date: meeting.startTime?.toISOString(),
      participants: meeting.participants.map((p) => p.name),
      transcript: meeting.transcript.fullText,
      segments,
      summary: meeting.summary?.content as MeetingContext['summary'],
    };

    const contextString = this.buildMeetingContext(meetingContext);
    const messages = this.buildConversationMessages(
      conversationHistory,
      contextString,
      question
    );

    // Select model
    const useAnthropic = preferredModel === 'claude' ||
      (!preferredModel && process.env.ANTHROPIC_API_KEY);

    let answer: string;
    let tokensUsed: number;
    let modelUsed: string;

    try {
      if (useAnthropic && process.env.ANTHROPIC_API_KEY) {
        const result = await this.askWithAnthropic(messages);
        answer = result.answer;
        tokensUsed = result.tokensUsed;
        modelUsed = result.model;
      } else if (process.env.OPENAI_API_KEY) {
        const result = await this.askWithOpenAI(messages);
        answer = result.answer;
        tokensUsed = result.tokensUsed;
        modelUsed = result.model;
      } else {
        throw new Error('No LLM API keys configured');
      }
    } catch (error) {
      logger.error({ error, meetingId }, 'Q&A generation failed');
      throw error;
    }

    const latencyMs = Date.now() - startTime;

    // Find relevant source segments
    const sources = this.findRelevantSegments(segments, answer);

    logger.info(
      {
        meetingId,
        questionLength: question.length,
        answerLength: answer.length,
        tokensUsed,
        modelUsed,
        latencyMs,
        sourcesFound: sources.length,
      },
      'Q&A completed'
    );

    return {
      answer,
      sources,
      tokensUsed,
      modelUsed,
      latencyMs,
    };
  }

  /**
   * Ask question using Anthropic Claude
   */
  private async askWithAnthropic(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ answer: string; tokensUsed: number; model: string }> {
    const client = await this.getAnthropicClient();

    const response = await client.messages.create({
      model: AI_MODELS.CLAUDE_SONNET,
      max_tokens: 2048,
      temperature: 0.3,
      system: QA_SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((block: { type: string; text?: string }) => block.type === 'text');
    const answer = textContent?.type === 'text' ? textContent.text ?? '' : '';

    return {
      answer,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: AI_MODELS.CLAUDE_SONNET,
    };
  }

  /**
   * Ask question using OpenAI GPT
   */
  private async askWithOpenAI(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ answer: string; tokensUsed: number; model: string }> {
    const client = await this.getOpenAIClient();

    const response = await client.chat.completions.create({
      model: AI_MODELS.GPT_4O_MINI,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: 'system', content: QA_SYSTEM_PROMPT },
        ...messages,
      ],
    });

    const answer = response.choices[0]?.message?.content || '';

    return {
      answer,
      tokensUsed: response.usage?.total_tokens || 0,
      model: AI_MODELS.GPT_4O_MINI,
    };
  }

  /**
   * Generate a title for a conversation based on first question
   */
  async generateConversationTitle(question: string): Promise<string> {
    // Simple title generation - take first 50 chars of question
    const cleaned = question.replace(/[^\w\s]/g, '').trim();
    if (cleaned.length <= 50) {
      return cleaned;
    }
    return cleaned.substring(0, 47) + '...';
  }

  /**
   * Get suggested questions for a meeting
   */
  async getSuggestedQuestions(meetingId: string): Promise<string[]> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        summary: true,
      },
    });

    if (!meeting) {
      return [];
    }

    const suggestions: string[] = [
      'What were the main topics discussed?',
      'What are the key decisions made in this meeting?',
      'What action items were assigned?',
    ];

    // Add context-specific suggestions based on summary
    const summary = (meeting as { summary?: { content?: MeetingContext['summary'] } }).summary?.content as MeetingContext['summary'];
    if (summary?.topics && summary.topics.length > 0) {
      const firstTopic = summary.topics[0]!.title;
      suggestions.push(`Tell me more about ${firstTopic}`);
    }

    if (summary?.actionItems && summary.actionItems.length > 0) {
      suggestions.push('Who is responsible for each action item?');
    }

    return suggestions;
  }
}

// Export singleton
export const meetingQAService = new MeetingQAService();
