# Phase 8.8: Meeting AI Chat

**Goal:** Enable users to have conversations with their meeting transcripts instead of reading through them — the #1 retention feature competitors have.

**Model:** Default

**Why This Matters:** This is what makes users say "I can't work without this tool."

---

## Pre-Phase Checklist

- [ ] Read PHASE_8_COMPLETE.md (or latest completed phase)
- [ ] Read project_docs/GOVERNANCE.md
- [ ] Verify Phase 4 (AI Summarization) is complete
- [ ] Verify pgvector extension is enabled in PostgreSQL
- [ ] Verify current tests pass: `pnpm test`

---

## Mandatory Updates (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_8_8_COMPLETE.md with summary and key decisions
2. **Update project_docs/PHASES.md**:
   - Add Phase 8.8 section after Phase 8.7
   - Add row to Summary Table: `| 8.8 | Meeting AI Chat | ✅ | 2-3 hours |`
   - Update Total Estimated Time
   - Add entry to Change Log
3. Run all tests and record coverage

---

## Competitor Analysis: Why This Matters

### Fireflies "AskFred"
> "AskFred is actually one of the best AI assistants I've used... I asked it to find a TED talk based on context from our conversation, and it found it!"

### Circleback AI Search
> "I can search across ALL meeting history and find needles in haystacks with the AI search"

### What Users Want
| Use Case | Example Query |
|----------|---------------|
| **Find specific info** | "What was the budget number John mentioned?" |
| **Recall decisions** | "What did we decide about the launch date?" |
| **Cross-meeting** | "What has Sarah said about pricing across all meetings?" |
| **Action clarity** | "What are my action items from this week?" |
| **Quick catch-up** | "Give me a 30-second summary of this meeting" |

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md

=== TASK LIST (Execute All) ===

---

## SECTION A: Database Schema

**8.8.1 Chat & Embedding Schema**

The TranscriptEmbedding model already exists. Add chat models to packages/database/prisma/schema.prisma:

```prisma
// ============================================
// Meeting AI Chat
// ============================================

// Chat conversation per meeting (or cross-meeting)
model MeetingChat {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  userId         String   @map("user_id")
  meetingId      String?  @map("meeting_id") // null = cross-meeting chat
  title          String?  // Auto-generated or user-set
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  meeting      Meeting?        @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  messages     ChatMessage[]

  @@index([organizationId])
  @@index([userId])
  @@index([meetingId])
  @@map("meeting_chats")
}

// Individual chat messages
model ChatMessage {
  id        String   @id @default(uuid())
  chatId    String   @map("chat_id")
  role      String   // "user" | "assistant"
  content   String
  
  // Source citations (for assistant messages)
  citations Json?    // [{meetingId, timestamp, text, relevance}]
  
  // Metadata
  model     String?  // "claude-3.5-sonnet" | "gpt-4o"
  tokens    Int?     // Token count for billing tracking
  latencyMs Int?     @map("latency_ms")
  
  createdAt DateTime @default(now()) @map("created_at")

  chat MeetingChat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@index([chatId])
  @@index([createdAt])
  @@map("chat_messages")
}

// Suggested questions per meeting (auto-generated)
model SuggestedQuestion {
  id        String   @id @default(uuid())
  meetingId String   @map("meeting_id")
  question  String
  category  String   // "decisions", "action_items", "key_points", "follow_up"
  priority  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@index([meetingId])
  @@map("suggested_questions")
}
```

Update existing models:

```prisma
model Organization {
  // ... existing fields ...
  meetingChats MeetingChat[]
}

model User {
  // ... existing fields ...
  meetingChats MeetingChat[]
}

model Meeting {
  // ... existing fields ...
  chats              MeetingChat[]
  suggestedQuestions SuggestedQuestion[]
}
```

Run migration:
```bash
pnpm db:migrate --name add_meeting_chat
```

---

## SECTION B: Embedding Service

**8.8.2 Vector Embedding Service**

Create services/embeddings/src/embeddingService.ts:

```typescript
/**
 * @ownership
 * @domain Vector Embeddings
 * @description Generate and manage embeddings for semantic search
 * @single-responsibility YES — embedding operations only
 */

import OpenAI from 'openai';
import { prisma } from '@zigznote/database';
import { logger } from '../../../apps/api/src/utils/logger';

// OpenAI for embeddings (best price/performance for embeddings)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 500; // words per chunk
const CHUNK_OVERLAP = 50; // words overlap between chunks

export interface EmbeddingChunk {
  index: number;
  text: string;
  embedding: number[];
  startTime?: number; // milliseconds into meeting
  endTime?: number;
  speaker?: string;
}

export interface SimilarChunk {
  meetingId: string;
  meetingTitle: string;
  chunkIndex: number;
  chunkText: string;
  startTime?: number;
  speaker?: string;
  similarity: number;
}

class EmbeddingService {
  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map(d => d.embedding);
  }

  /**
   * Chunk transcript into overlapping segments
   */
  chunkTranscript(
    segments: Array<{ speaker: string; text: string; startTime: number; endTime: number }>
  ): Array<{ text: string; startTime: number; endTime: number; speakers: string[] }> {
    const chunks: Array<{ text: string; startTime: number; endTime: number; speakers: string[] }> = [];
    
    let currentChunk = {
      words: [] as string[],
      startTime: 0,
      endTime: 0,
      speakers: new Set<string>(),
    };

    for (const segment of segments) {
      const words = segment.text.split(/\s+/);
      
      if (currentChunk.words.length === 0) {
        currentChunk.startTime = segment.startTime;
      }

      for (const word of words) {
        currentChunk.words.push(word);
        currentChunk.speakers.add(segment.speaker);
        currentChunk.endTime = segment.endTime;

        // When chunk is full, save it and start new one with overlap
        if (currentChunk.words.length >= CHUNK_SIZE) {
          chunks.push({
            text: currentChunk.words.join(' '),
            startTime: currentChunk.startTime,
            endTime: currentChunk.endTime,
            speakers: Array.from(currentChunk.speakers),
          });

          // Keep last CHUNK_OVERLAP words for context continuity
          currentChunk = {
            words: currentChunk.words.slice(-CHUNK_OVERLAP),
            startTime: segment.startTime,
            endTime: segment.endTime,
            speakers: new Set([segment.speaker]),
          };
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.words.length > 0) {
      chunks.push({
        text: currentChunk.words.join(' '),
        startTime: currentChunk.startTime,
        endTime: currentChunk.endTime,
        speakers: Array.from(currentChunk.speakers),
      });
    }

    return chunks;
  }

  /**
   * Generate and store embeddings for a meeting transcript
   */
  async embedMeetingTranscript(meetingId: string): Promise<number> {
    const transcript = await prisma.transcript.findUnique({
      where: { meetingId },
    });

    if (!transcript) {
      throw new Error(`Transcript not found for meeting ${meetingId}`);
    }

    // Parse segments from JSON
    const segments = transcript.segments as Array<{
      speaker: string;
      text: string;
      start_ms: number;
      end_ms: number;
    }>;

    // Convert to expected format
    const formattedSegments = segments.map(s => ({
      speaker: s.speaker,
      text: s.text,
      startTime: s.start_ms,
      endTime: s.end_ms,
    }));

    // Chunk the transcript
    const chunks = this.chunkTranscript(formattedSegments);

    if (chunks.length === 0) {
      logger.warn({ meetingId }, 'No chunks generated from transcript');
      return 0;
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 20;
    let totalEmbedded = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.text);
      
      const embeddings = await this.generateEmbeddings(texts);

      // Store embeddings
      const createData = batch.map((chunk, j) => ({
        meetingId,
        chunkIndex: i + j,
        chunkText: chunk.text,
        embedding: Buffer.from(new Float32Array(embeddings[j]).buffer),
        metadata: {
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          speakers: chunk.speakers,
        },
      }));

      await prisma.transcriptEmbedding.createMany({
        data: createData.map(d => ({
          meetingId: d.meetingId,
          chunkIndex: d.chunkIndex,
          chunkText: d.chunkText,
          embedding: d.embedding,
        })),
        skipDuplicates: true,
      });

      totalEmbedded += batch.length;
    }

    logger.info({ meetingId, chunks: totalEmbedded }, 'Meeting transcript embedded');
    return totalEmbedded;
  }

  /**
   * Find similar chunks using cosine similarity
   * Uses pgvector for efficient vector search
   */
  async findSimilarChunks(
    organizationId: string,
    query: string,
    options: {
      meetingId?: string; // Limit to specific meeting
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SimilarChunk[]> {
    const { meetingId, limit = 10, minSimilarity = 0.7 } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Use raw SQL with pgvector for similarity search
    // The <=> operator computes cosine distance (1 - similarity)
    const results = await prisma.$queryRaw<Array<{
      meeting_id: string;
      meeting_title: string;
      chunk_index: number;
      chunk_text: string;
      similarity: number;
    }>>`
      SELECT 
        te.meeting_id,
        m.title as meeting_title,
        te.chunk_index,
        te.chunk_text,
        1 - (te.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM transcript_embeddings te
      JOIN meetings m ON m.id = te.meeting_id
      WHERE m.organization_id = ${organizationId}
        ${meetingId ? prisma.$queryRaw`AND te.meeting_id = ${meetingId}` : prisma.$queryRaw``}
        AND m.deleted_at IS NULL
      ORDER BY te.embedding <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    `;

    // Filter by minimum similarity and map to response format
    return results
      .filter(r => r.similarity >= minSimilarity)
      .map(r => ({
        meetingId: r.meeting_id,
        meetingTitle: r.meeting_title,
        chunkIndex: r.chunk_index,
        chunkText: r.chunk_text,
        similarity: r.similarity,
      }));
  }

  /**
   * Check if a meeting has embeddings
   */
  async hasEmbeddings(meetingId: string): Promise<boolean> {
    const count = await prisma.transcriptEmbedding.count({
      where: { meetingId },
    });
    return count > 0;
  }

  /**
   * Delete embeddings for a meeting (for re-embedding)
   */
  async deleteEmbeddings(meetingId: string): Promise<number> {
    const result = await prisma.transcriptEmbedding.deleteMany({
      where: { meetingId },
    });
    return result.count;
  }
}

export const embeddingService = new EmbeddingService();
```

---

## SECTION C: Chat Service

**8.8.3 Meeting Chat Service**

Create apps/api/src/services/meetingChatService.ts:

```typescript
/**
 * @ownership
 * @domain Meeting AI Chat
 * @description Handle conversations about meeting content
 * @single-responsibility YES — chat operations only
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { prisma } from '@zigznote/database';
import { embeddingService, SimilarChunk } from '../../../../services/embeddings/src/embeddingService';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model selection
const PRIMARY_MODEL = 'claude-3-5-sonnet-20241022';
const FALLBACK_MODEL = 'gpt-4o';

export interface Citation {
  meetingId: string;
  meetingTitle: string;
  timestamp?: number; // milliseconds
  text: string;
  relevance: number;
}

export interface ChatResponse {
  content: string;
  citations: Citation[];
  model: string;
  tokens: number;
  latencyMs: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class MeetingChatService {
  /**
   * Create a new chat session
   */
  async createChat(
    organizationId: string,
    userId: string,
    meetingId?: string
  ): Promise<{ id: string; title: string | null }> {
    const chat = await prisma.meetingChat.create({
      data: {
        organizationId,
        userId,
        meetingId,
        title: meetingId ? null : 'Cross-meeting chat',
      },
    });

    return { id: chat.id, title: chat.title };
  }

  /**
   * Get chat history
   */
  async getChatHistory(chatId: string): Promise<ChatMessage[]> {
    const messages = await prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    chatId: string,
    userMessage: string,
    organizationId: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // Get chat context
    const chat = await prisma.meetingChat.findUnique({
      where: { id: chatId },
      include: {
        meeting: {
          include: {
            transcript: true,
            summary: true,
          },
        },
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
        content: userMessage,
      },
    });

    // Find relevant context using semantic search
    const relevantChunks = await embeddingService.findSimilarChunks(
      organizationId,
      userMessage,
      {
        meetingId: chat.meetingId || undefined,
        limit: 5,
        minSimilarity: 0.6,
      }
    );

    // Get chat history for context
    const history = await this.getChatHistory(chatId);
    const recentHistory = history.slice(-10); // Last 10 messages

    // Build the prompt
    const systemPrompt = this.buildSystemPrompt(chat, relevantChunks);
    const messages = this.buildMessages(recentHistory, userMessage);

    // Generate response
    let response: ChatResponse;
    
    try {
      response = await this.generateWithClaude(systemPrompt, messages, relevantChunks);
    } catch (error) {
      logger.warn({ error }, 'Claude failed, falling back to GPT-4');
      response = await this.generateWithOpenAI(systemPrompt, messages, relevantChunks);
    }

    response.latencyMs = Date.now() - startTime;

    // Store assistant message
    await prisma.chatMessage.create({
      data: {
        chatId,
        role: 'assistant',
        content: response.content,
        citations: response.citations as any,
        model: response.model,
        tokens: response.tokens,
        latencyMs: response.latencyMs,
      },
    });

    return response;
  }

  /**
   * Build system prompt with meeting context
   */
  private buildSystemPrompt(
    chat: any,
    relevantChunks: SimilarChunk[]
  ): string {
    let prompt = `You are an AI assistant helping users understand their meeting content. You have access to meeting transcripts and can answer questions about what was discussed.

## Guidelines
- Be concise and direct in your answers
- Always cite specific parts of the transcript when making claims
- If you're not sure about something, say so
- Use timestamps when available to help users find specific moments
- For action items, mention who is responsible and any deadlines

`;

    // Add meeting context if single-meeting chat
    if (chat.meeting) {
      prompt += `## Current Meeting
Title: ${chat.meeting.title}
Date: ${chat.meeting.startTime?.toLocaleDateString() || 'Unknown'}
Duration: ${chat.meeting.durationSeconds ? Math.round(chat.meeting.durationSeconds / 60) + ' minutes' : 'Unknown'}

`;

      // Add summary if available
      if (chat.meeting.summary?.content) {
        const summary = chat.meeting.summary.content as any;
        prompt += `## Meeting Summary
${summary.executive_summary || 'No summary available'}

Key Topics: ${summary.topics?.join(', ') || 'None identified'}
Decisions Made: ${summary.decisions?.length || 0}
Action Items: ${summary.action_items?.length || 0}

`;
      }
    }

    // Add relevant transcript excerpts
    if (relevantChunks.length > 0) {
      prompt += `## Relevant Transcript Excerpts
`;
      for (const chunk of relevantChunks) {
        prompt += `
[From "${chunk.meetingTitle}" - Relevance: ${Math.round(chunk.similarity * 100)}%]
${chunk.chunkText}
---
`;
      }
    }

    return prompt;
  }

  /**
   * Build message array for LLM
   */
  private buildMessages(
    history: ChatMessage[],
    currentMessage: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Generate response with Claude
   */
  private async generateWithClaude(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    relevantChunks: SimilarChunk[]
  ): Promise<ChatResponse> {
    const response = await anthropic.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Extract citations from the response
    const citations = this.extractCitations(content, relevantChunks);

    return {
      content,
      citations,
      model: PRIMARY_MODEL,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs: 0, // Will be set by caller
    };
  }

  /**
   * Generate response with OpenAI (fallback)
   */
  private async generateWithOpenAI(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    relevantChunks: SimilarChunk[]
  ): Promise<ChatResponse> {
    const response = await openai.chat.completions.create({
      model: FALLBACK_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    const content = response.choices[0].message.content || '';

    // Extract citations from the response
    const citations = this.extractCitations(content, relevantChunks);

    return {
      content,
      citations,
      model: FALLBACK_MODEL,
      tokens: response.usage?.total_tokens || 0,
      latencyMs: 0,
    };
  }

  /**
   * Extract citations based on content overlap with chunks
   */
  private extractCitations(
    response: string,
    relevantChunks: SimilarChunk[]
  ): Citation[] {
    // Simple approach: include all relevant chunks as citations
    // A more sophisticated approach would analyze the response text
    return relevantChunks.map(chunk => ({
      meetingId: chunk.meetingId,
      meetingTitle: chunk.meetingTitle,
      text: chunk.chunkText.substring(0, 200) + '...',
      relevance: chunk.similarity,
    }));
  }

  /**
   * Generate suggested questions for a meeting
   */
  async generateSuggestedQuestions(meetingId: string): Promise<string[]> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        summary: true,
        actionItems: true,
      },
    });

    if (!meeting || !meeting.summary) {
      return [];
    }

    const summary = meeting.summary.content as any;
    const questions: Array<{ question: string; category: string; priority: number }> = [];

    // Generate questions based on content
    if (summary.decisions?.length > 0) {
      questions.push({
        question: 'What were the main decisions made in this meeting?',
        category: 'decisions',
        priority: 1,
      });
    }

    if (meeting.actionItems.length > 0) {
      questions.push({
        question: 'What are my action items from this meeting?',
        category: 'action_items',
        priority: 1,
      });
      questions.push({
        question: 'What are the deadlines for the action items?',
        category: 'action_items',
        priority: 2,
      });
    }

    if (summary.topics?.length > 0) {
      questions.push({
        question: `Tell me more about "${summary.topics[0]}"`,
        category: 'key_points',
        priority: 2,
      });
    }

    questions.push({
      question: 'What were the key takeaways from this meeting?',
      category: 'key_points',
      priority: 1,
    });

    questions.push({
      question: 'Were there any disagreements or concerns raised?',
      category: 'follow_up',
      priority: 3,
    });

    // Store suggested questions
    await prisma.suggestedQuestion.createMany({
      data: questions.map(q => ({
        meetingId,
        question: q.question,
        category: q.category,
        priority: q.priority,
      })),
      skipDuplicates: true,
    });

    return questions.map(q => q.question);
  }

  /**
   * Get suggested questions for a meeting
   */
  async getSuggestedQuestions(meetingId: string): Promise<string[]> {
    const questions = await prisma.suggestedQuestion.findMany({
      where: { meetingId },
      orderBy: { priority: 'asc' },
      take: 5,
    });

    if (questions.length === 0) {
      // Generate them if they don't exist
      return this.generateSuggestedQuestions(meetingId);
    }

    return questions.map(q => q.question);
  }

  /**
   * Cross-meeting search
   */
  async searchAcrossMeetings(
    organizationId: string,
    query: string
  ): Promise<{
    answer: string;
    sources: Array<{
      meetingId: string;
      meetingTitle: string;
      date: Date;
      excerpt: string;
      relevance: number;
    }>;
  }> {
    // Find relevant chunks across all meetings
    const relevantChunks = await embeddingService.findSimilarChunks(
      organizationId,
      query,
      { limit: 10, minSimilarity: 0.6 }
    );

    if (relevantChunks.length === 0) {
      return {
        answer: "I couldn't find any relevant information in your meeting history for that query.",
        sources: [],
      };
    }

    // Get meeting details for context
    const meetingIds = [...new Set(relevantChunks.map(c => c.meetingId))];
    const meetings = await prisma.meeting.findMany({
      where: { id: { in: meetingIds } },
      select: { id: true, title: true, startTime: true },
    });

    const meetingMap = new Map(meetings.map(m => [m.id, m]));

    // Build context for LLM
    const context = relevantChunks
      .map(chunk => {
        const meeting = meetingMap.get(chunk.meetingId);
        return `[${meeting?.title} - ${meeting?.startTime?.toLocaleDateString()}]
${chunk.chunkText}`;
      })
      .join('\n\n---\n\n');

    // Generate synthesized answer
    const response = await anthropic.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: 1024,
      system: `You are an AI assistant that helps users find information across their meeting history. 
Synthesize the relevant excerpts to answer the user's question.
Always mention which meeting(s) the information comes from.
Be concise and direct.`,
      messages: [
        {
          role: 'user',
          content: `Based on the following meeting excerpts, answer this question: "${query}"

Meeting excerpts:
${context}`,
        },
      ],
    });

    const answer = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Format sources
    const sources = relevantChunks.map(chunk => {
      const meeting = meetingMap.get(chunk.meetingId);
      return {
        meetingId: chunk.meetingId,
        meetingTitle: meeting?.title || 'Unknown',
        date: meeting?.startTime || new Date(),
        excerpt: chunk.chunkText.substring(0, 150) + '...',
        relevance: chunk.similarity,
      };
    });

    return { answer, sources };
  }
}

export const meetingChatService = new MeetingChatService();
```

---

## SECTION D: API Routes

**8.8.4 Chat API Routes**

Create apps/api/src/routes/chat.ts:

```typescript
/**
 * Meeting Chat API routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { meetingChatService } from '../services/meetingChatService';
import { embeddingService } from '../../../../services/embeddings/src/embeddingService';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';
import { prisma } from '@zigznote/database';
import { errors } from '../utils/errors';

export const chatRouter: IRouter = Router();

chatRouter.use(requireAuth);

// === CHAT SESSIONS ===

/**
 * POST /api/v1/chats
 * Create a new chat session
 */
chatRouter.post(
  '/',
  validateRequest(z.object({
    body: z.object({
      meetingId: z.string().uuid().optional(), // Optional for cross-meeting chat
    }),
  })),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { meetingId } = req.body;

    // Verify meeting access if provided
    if (meetingId) {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting || meeting.organizationId !== authReq.auth!.organizationId) {
        throw errors.notFound('Meeting');
      }
    }

    const chat = await meetingChatService.createChat(
      authReq.auth!.organizationId,
      authReq.auth!.userId,
      meetingId
    );

    res.status(201).json({
      success: true,
      data: chat,
    });
  })
);

/**
 * GET /api/v1/chats
 * List user's chat sessions
 */
chatRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;

    const chats = await prisma.meetingChat.findMany({
      where: {
        userId: authReq.auth!.userId,
        organizationId: authReq.auth!.organizationId,
      },
      include: {
        meeting: {
          select: { id: true, title: true, startTime: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: chats.map(chat => ({
        id: chat.id,
        title: chat.title || chat.meeting?.title || 'Cross-meeting chat',
        meetingId: chat.meetingId,
        meetingTitle: chat.meeting?.title,
        meetingDate: chat.meeting?.startTime,
        messageCount: chat._count.messages,
        updatedAt: chat.updatedAt,
      })),
    });
  })
);

/**
 * GET /api/v1/chats/:id
 * Get chat with messages
 */
chatRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const chat = await prisma.meetingChat.findFirst({
      where: {
        id,
        userId: authReq.auth!.userId,
      },
      include: {
        meeting: {
          select: { id: true, title: true, startTime: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      throw errors.notFound('Chat');
    }

    res.json({
      success: true,
      data: {
        id: chat.id,
        title: chat.title || chat.meeting?.title || 'Cross-meeting chat',
        meetingId: chat.meetingId,
        meeting: chat.meeting,
        messages: chat.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          createdAt: m.createdAt,
        })),
      },
    });
  })
);

/**
 * POST /api/v1/chats/:id/messages
 * Send a message in a chat
 */
chatRouter.post(
  '/:id/messages',
  validateRequest(z.object({
    body: z.object({
      message: z.string().min(1).max(2000),
    }),
  })),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { message } = req.body;

    // Verify chat ownership
    const chat = await prisma.meetingChat.findFirst({
      where: {
        id,
        userId: authReq.auth!.userId,
      },
    });

    if (!chat) {
      throw errors.notFound('Chat');
    }

    const response = await meetingChatService.sendMessage(
      id,
      message,
      authReq.auth!.organizationId
    );

    res.json({
      success: true,
      data: {
        content: response.content,
        citations: response.citations,
        model: response.model,
        latencyMs: response.latencyMs,
      },
    });
  })
);

/**
 * DELETE /api/v1/chats/:id
 * Delete a chat session
 */
chatRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const chat = await prisma.meetingChat.findFirst({
      where: {
        id,
        userId: authReq.auth!.userId,
      },
    });

    if (!chat) {
      throw errors.notFound('Chat');
    }

    await prisma.meetingChat.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Chat deleted',
    });
  })
);

// === MEETING-SPECIFIC ENDPOINTS ===

/**
 * GET /api/v1/meetings/:meetingId/chat
 * Get or create chat for a specific meeting
 */
chatRouter.get(
  '/meetings/:meetingId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { meetingId } = req.params;

    // Verify meeting access
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting || meeting.organizationId !== authReq.auth!.organizationId) {
      throw errors.notFound('Meeting');
    }

    // Find existing chat or create new one
    let chat = await prisma.meetingChat.findFirst({
      where: {
        meetingId,
        userId: authReq.auth!.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      chat = await prisma.meetingChat.create({
        data: {
          organizationId: authReq.auth!.organizationId,
          userId: authReq.auth!.userId,
          meetingId,
        },
        include: {
          messages: true,
        },
      });
    }

    // Get suggested questions
    const suggestedQuestions = await meetingChatService.getSuggestedQuestions(meetingId);

    res.json({
      success: true,
      data: {
        chatId: chat.id,
        messages: chat.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          createdAt: m.createdAt,
        })),
        suggestedQuestions,
      },
    });
  })
);

/**
 * POST /api/v1/meetings/:meetingId/embed
 * Generate embeddings for a meeting (admin/background job)
 */
chatRouter.post(
  '/meetings/:meetingId/embed',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { meetingId } = req.params;

    // Verify meeting access
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting || meeting.organizationId !== authReq.auth!.organizationId) {
      throw errors.notFound('Meeting');
    }

    const chunksEmbedded = await embeddingService.embedMeetingTranscript(meetingId);

    res.json({
      success: true,
      data: {
        meetingId,
        chunksEmbedded,
      },
    });
  })
);

// === CROSS-MEETING SEARCH ===

/**
 * POST /api/v1/chat/search
 * Search across all meetings
 */
chatRouter.post(
  '/search',
  validateRequest(z.object({
    body: z.object({
      query: z.string().min(3).max(500),
    }),
  })),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { query } = req.body;

    const result = await meetingChatService.searchAcrossMeetings(
      authReq.auth!.organizationId,
      query
    );

    res.json({
      success: true,
      data: result,
    });
  })
);
```

Register routes in apps/api/src/routes/api.ts:
```typescript
import { chatRouter } from './chat';

apiRouter.use('/v1/chat', chatRouter);
```

---

## SECTION E: Background Job for Embeddings

**8.8.5 Embedding Worker**

Create services/embeddings/src/worker.ts:

```typescript
/**
 * Background worker for generating embeddings
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { embeddingService } from './embeddingService';
import { meetingChatService } from '../../../apps/api/src/services/meetingChatService';
import { prisma } from '@zigznote/database';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'embeddings';

interface EmbeddingJobData {
  meetingId: string;
  generateQuestions?: boolean;
}

async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  const { meetingId, generateQuestions = true } = job.data;

  console.log(`[Embedding Worker] Processing meeting ${meetingId}`);

  try {
    // Check if transcript exists
    const transcript = await prisma.transcript.findUnique({
      where: { meetingId },
    });

    if (!transcript) {
      console.log(`[Embedding Worker] No transcript for meeting ${meetingId}, skipping`);
      return;
    }

    // Check if already embedded
    const hasEmbeddings = await embeddingService.hasEmbeddings(meetingId);
    
    if (hasEmbeddings) {
      console.log(`[Embedding Worker] Meeting ${meetingId} already embedded, skipping`);
      return;
    }

    // Generate embeddings
    const chunksEmbedded = await embeddingService.embedMeetingTranscript(meetingId);
    console.log(`[Embedding Worker] Embedded ${chunksEmbedded} chunks for meeting ${meetingId}`);

    // Generate suggested questions
    if (generateQuestions) {
      await meetingChatService.generateSuggestedQuestions(meetingId);
      console.log(`[Embedding Worker] Generated suggested questions for meeting ${meetingId}`);
    }

  } catch (error) {
    console.error(`[Embedding Worker] Error processing meeting ${meetingId}:`, error);
    throw error; // Re-throw to trigger retry
  }
}

// Create worker
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<EmbeddingJobData>(QUEUE_NAME, processEmbeddingJob, {
  connection,
  concurrency: 2, // Process 2 meetings at a time
  limiter: {
    max: 10,
    duration: 60000, // Max 10 per minute (API rate limits)
  },
});

worker.on('completed', (job) => {
  console.log(`[Embedding Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  console.error(`[Embedding Worker] Job ${job?.id} failed:`, error);
});

console.log('[Embedding Worker] Started');
```

Add queue to existing job infrastructure in apps/api/src/jobs/queues.ts:
```typescript
export const embeddingQueue = new Queue('embeddings', { connection: redisConnection });
```

Trigger embedding after summarization completes (add to summarization worker):
```typescript
// After summary is saved, queue embedding job
await embeddingQueue.add('embed', { meetingId, generateQuestions: true });
```

---

## SECTION F: Frontend Components

**8.8.6 Chat Interface Component**

Create apps/web/components/meetings/MeetingChat.tsx:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  ExternalLink,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    meetingId: string;
    meetingTitle: string;
    text: string;
    relevance: number;
  }>;
  createdAt: string;
}

interface MeetingChatProps {
  meetingId: string;
  meetingTitle: string;
}

export function MeetingChat({ meetingId, meetingTitle }: MeetingChatProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch chat data
  const { data: chatData, isLoading } = useQuery({
    queryKey: ['meetingChat', meetingId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/chat/meetings/${meetingId}`);
      return response.data;
    },
    enabled: isExpanded,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await api.post(`/api/v1/chats/${chatData.chatId}/messages`, {
        message,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingChat', meetingId] });
      setInput('');
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData?.messages]);

  const handleSend = () => {
    if (input.trim() && !sendMessage.isPending) {
      sendMessage.mutate(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  if (!isExpanded) {
    return (
      <Card 
        className="cursor-pointer hover:border-primary-300 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Bot className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900">Ask about this meeting</h3>
            <p className="text-sm text-slate-500">
              Get instant answers instead of reading the transcript
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-primary-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary-600" />
            Ask about this meeting
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            Minimize
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : chatData?.messages?.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">
                Ask me anything about "{meetingTitle}"
              </p>
              
              {/* Suggested questions */}
              {chatData?.suggestedQuestions?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {chatData.suggestedQuestions.map((question: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {chatData?.messages?.map((message: Message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary-600" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5',
                      message.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-100 text-slate-900'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                          Sources
                        </p>
                        {message.citations.map((citation, i) => (
                          <div
                            key={i}
                            className="text-xs bg-white rounded p-2 border border-slate-200"
                          >
                            <div className="flex items-center gap-1 text-slate-500 mb-1">
                              <ExternalLink className="h-3 w-3" />
                              <span>{citation.meetingTitle}</span>
                            </div>
                            <p className="text-slate-600 line-clamp-2">
                              {citation.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          
          {/* Loading indicator when sending */}
          {sendMessage.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this meeting..."
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**8.8.7 Cross-Meeting Search Component**

Create apps/web/components/search/AskAcrossMeetings.tsx:

```tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Search, 
  Sparkles, 
  ExternalLink,
  Calendar,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import Link from 'next/link';

interface SearchResult {
  answer: string;
  sources: Array<{
    meetingId: string;
    meetingTitle: string;
    date: string;
    excerpt: string;
    relevance: number;
  }>;
}

export function AskAcrossMeetings() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);

  const search = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await api.post('/api/v1/chat/search', {
        query: searchQuery,
      });
      return response.data as SearchResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleSearch = () => {
    if (query.trim().length >= 3) {
      search.mutate(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const exampleQueries = [
    "What did we decide about the Q2 budget?",
    "What has John said about the new product?",
    "Show me all discussions about hiring",
    "What are the pending action items?",
  ];

  return (
    <div className="space-y-6">
      {/* Search input */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center">
            <div className="p-4">
              <Sparkles className="h-5 w-5 text-primary-500" />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything across all your meetings..."
              className="flex-1 py-4 text-lg focus:outline-none"
            />
            <div className="p-2">
              <Button
                onClick={handleSearch}
                disabled={query.trim().length < 3 || search.isPending}
              >
                {search.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example queries */}
      {!result && !search.isPending && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(example);
                  search.mutate(example);
                }}
                className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {search.isPending && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-3" />
            <p className="text-slate-500">Searching across your meetings...</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Answer */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {result.answer}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700">
                Sources ({result.sources.length} meetings)
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {result.sources.map((source, i) => (
                  <Link
                    key={i}
                    href={`/meetings/${source.meetingId}`}
                    className="block"
                  >
                    <Card className="hover:border-primary-300 transition-colors h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-slate-900 line-clamp-1">
                            {source.meetingTitle}
                          </h4>
                          <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(source.date).toLocaleDateString()}</span>
                          <span className="text-primary-500">
                            {Math.round(source.relevance * 100)}% match
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {source.excerpt}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* New search */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setResult(null);
              }}
            >
              Ask another question
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

---

## SECTION G: Integration with Meeting Detail Page

**8.8.8 Add Chat to Meeting Page**

Update apps/web/app/(dashboard)/meetings/[id]/page.tsx to include the chat component:

```tsx
// Add import
import { MeetingChat } from '@/components/meetings/MeetingChat';

// Add to the page layout, after the summary panel:
<div className="mt-6">
  <MeetingChat 
    meetingId={meeting.id} 
    meetingTitle={meeting.title} 
  />
</div>
```

**8.8.9 Add Cross-Meeting Search to Search Page**

Update apps/web/app/(dashboard)/search/page.tsx:

```tsx
import { AskAcrossMeetings } from '@/components/search/AskAcrossMeetings';

export default function SearchPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-500">
          Ask questions across all your meetings
        </p>
      </div>

      <AskAcrossMeetings />

      {/* Existing keyword search UI */}
      {/* ... */}
    </div>
  );
}
```

---

## SECTION H: Tests

**8.8.10 Embedding Service Tests**

Create services/embeddings/tests/embeddingService.test.ts:

```typescript
import { embeddingService } from '../src/embeddingService';

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    },
  })),
}));

describe('EmbeddingService', () => {
  describe('chunkTranscript', () => {
    it('should chunk transcript into overlapping segments', () => {
      const segments = [
        { speaker: 'Speaker 1', text: 'Hello world this is a test', startTime: 0, endTime: 1000 },
        { speaker: 'Speaker 2', text: 'Yes this is working fine', startTime: 1000, endTime: 2000 },
      ];

      const chunks = embeddingService.chunkTranscript(segments);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('Hello');
      expect(chunks[0].speakers).toContain('Speaker 1');
    });

    it('should handle empty segments', () => {
      const chunks = embeddingService.chunkTranscript([]);
      expect(chunks).toEqual([]);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const embedding = await embeddingService.generateEmbedding('test text');
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });
  });
});
```

**8.8.11 Chat Service Tests**

Create apps/api/tests/services/meetingChatService.test.ts:

```typescript
import { meetingChatService } from '../../src/services/meetingChatService';
import { prisma } from '@zigznote/database';

// Mock dependencies
jest.mock('@zigznote/database', () => ({
  prisma: {
    meetingChat: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    suggestedQuestion: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../../services/embeddings/src/embeddingService', () => ({
  embeddingService: {
    findSimilarChunks: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

describe('MeetingChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChat', () => {
    it('should create a new chat session', async () => {
      (prisma.meetingChat.create as jest.Mock).mockResolvedValue({
        id: 'chat-1',
        title: null,
      });

      const chat = await meetingChatService.createChat(
        'org-1',
        'user-1',
        'meeting-1'
      );

      expect(chat.id).toBe('chat-1');
      expect(prisma.meetingChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          meetingId: 'meeting-1',
        }),
      });
    });
  });

  describe('getChatHistory', () => {
    it('should return chat messages', async () => {
      (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      const history = await meetingChatService.getChatHistory('chat-1');

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });
});
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] Database migration runs successfully
- [ ] Embedding service generates vectors
- [ ] Chat API endpoints work (create, send message, get history)
- [ ] Cross-meeting search returns relevant results
- [ ] Frontend chat component renders correctly
- [ ] Suggested questions are generated
- [ ] Citations are displayed in responses
- [ ] pgvector similarity search works
- [ ] Background embedding job processes meetings
- [ ] Tests pass for embedding and chat services
- [ ] **PHASES.md updated with Phase 8.8**
- [ ] PHASE_8_8_COMPLETE.md created

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add Meeting AI Chat for conversational transcript access

The killer retention feature - users can now chat with their meetings:

Per-Meeting Chat:
- Ask questions about any meeting
- Get AI answers with source citations
- Suggested questions auto-generated
- Timestamps link to specific moments

Cross-Meeting Search:
- Search across all meeting history
- Semantic understanding via embeddings
- Find 'needles in haystacks'
- Sources ranked by relevance

Technical Implementation:
- pgvector for semantic similarity search
- OpenAI embeddings (text-embedding-3-small)
- Claude 3.5 Sonnet for responses (GPT-4o fallback)
- Background embedding worker
- Chat session persistence

Based on competitor analysis:
- Matches Fireflies 'AskFred' functionality
- Matches Circleback AI search
- Better than Otter (which lacks this feature)

This is what makes users say 'I can't work without this tool'"
```

---

## Summary

After completing Phase 8.8:

| Feature | Status |
|---------|--------|
| Per-meeting chat UI | ✅ |
| Cross-meeting search | ✅ |
| Semantic embeddings | ✅ |
| Suggested questions | ✅ |
| Source citations | ✅ |
| Chat history | ✅ |
| Background embedding | ✅ |

### User Experience

**Before:** User reads 45-minute transcript to find one detail.

**After:**
```
User: "What did Sarah say about the budget?"

AI: "Sarah mentioned that the Q2 budget should be increased 
by 15% to account for the new marketing campaign. She suggested 
reallocating funds from the trade show budget since those events 
have lower ROI this year."

[Source: Weekly Standup - Jan 3, 2026 - 12:45]
```

### Competitive Positioning

| Feature | Fireflies | Otter | Circleback | zigznote |
|---------|-----------|-------|------------|----------|
| Chat with meeting | ✅ AskFred | ❌ | ✅ | ✅ |
| Cross-meeting search | ✅ | ⚠️ Basic | ✅ | ✅ |
| Source citations | ⚠️ | ❌ | ⚠️ | ✅ |
| Suggested questions | ❌ | ❌ | ❌ | ✅ |

This is the feature that transforms zigznote from "useful" to "essential."
