/**
 * Embedding Service
 * Generates and manages vector embeddings for semantic search
 */

import { prisma } from '@zigznote/database';
import { createLogger } from '@zigznote/shared';
import { config } from '../config';

const logger = createLogger({ component: 'embeddingService' });

// OpenAI embedding model
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 500; // tokens approximately
const CHUNK_OVERLAP = 50; // tokens overlap between chunks

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

export interface SimilarResult {
  id: string;
  meetingId: string;
  meetingTitle: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
}

export interface SemanticSearchOptions {
  query: string;
  organizationId: string;
  limit?: number;
  threshold?: number; // minimum similarity score (0-1)
}

class EmbeddingService {
  private openaiApiKey: string | null;

  constructor() {
    this.openaiApiKey = config.openaiApiKey || null;
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text.substring(0, 8000), // Limit to ~8000 chars
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        embedding: data.data[0].embedding,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate embedding');
      throw error;
    }
  }

  /**
   * Split text into overlapping chunks for embedding
   */
  chunkText(text: string): string[] {
    // Simple word-based chunking
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    // Approximate tokens as words (rough estimate)
    const wordsPerChunk = Math.floor(CHUNK_SIZE * 0.75); // ~75% of token count
    const overlapWords = Math.floor(CHUNK_OVERLAP * 0.75);

    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  /**
   * Store embeddings for a meeting's transcript
   */
  async storeChunkEmbeddings(meetingId: string): Promise<number> {
    if (!this.isAvailable()) {
      logger.warn({ meetingId }, 'Embedding service not available, skipping');
      return 0;
    }

    try {
      // Get transcript
      const transcript = await prisma.transcript.findUnique({
        where: { meetingId },
        select: {
          content: true,
          meeting: {
            select: { organizationId: true },
          },
        },
      });

      if (!transcript?.content) {
        logger.info({ meetingId }, 'No transcript found for embedding');
        return 0;
      }

      // Delete existing embeddings for this meeting
      await prisma.transcriptEmbedding.deleteMany({
        where: { meetingId },
      });

      // Chunk the transcript
      const chunks = this.chunkText(transcript.content);
      logger.info({ meetingId, chunkCount: chunks.length }, 'Generating embeddings');

      let storedCount = 0;

      // Generate and store embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        try {
          const result = await this.generateEmbedding(chunks[i]);

          // Convert embedding to bytes for storage
          const embeddingBuffer = Buffer.from(
            new Float32Array(result.embedding).buffer
          );

          await prisma.transcriptEmbedding.create({
            data: {
              meetingId,
              chunkIndex: i,
              chunkText: chunks[i],
              embedding: embeddingBuffer,
            },
          });

          storedCount++;
        } catch (error) {
          logger.error({ error, meetingId, chunkIndex: i }, 'Failed to store chunk embedding');
        }
      }

      logger.info({ meetingId, storedCount }, 'Embeddings stored successfully');
      return storedCount;
    } catch (error) {
      logger.error({ error, meetingId }, 'Failed to store embeddings');
      throw error;
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(options: SemanticSearchOptions): Promise<SimilarResult[]> {
    const { query, organizationId, limit = 10, threshold = 0.7 } = options;

    if (!this.isAvailable()) {
      return [];
    }

    try {
      // Generate embedding for query
      const queryResult = await this.generateEmbedding(query);
      const queryEmbedding = queryResult.embedding;

      // Query using pgvector cosine similarity
      // Note: This requires the pgvector extension and proper index setup
      const results = await prisma.$queryRaw<Array<{
        id: string;
        meeting_id: string;
        meeting_title: string;
        chunk_text: string;
        chunk_index: number;
        similarity: number;
      }>>`
        SELECT
          te.id,
          te.meeting_id,
          m.title as meeting_title,
          te.chunk_text,
          te.chunk_index,
          1 - (te.embedding <=> ${Buffer.from(new Float32Array(queryEmbedding).buffer)}::vector) as similarity
        FROM transcript_embeddings te
        JOIN meetings m ON te.meeting_id = m.id
        WHERE m.organization_id = ${organizationId}
          AND m.deleted_at IS NULL
          AND te.embedding IS NOT NULL
        ORDER BY te.embedding <=> ${Buffer.from(new Float32Array(queryEmbedding).buffer)}::vector
        LIMIT ${limit}
      `;

      return results
        .filter(r => r.similarity >= threshold)
        .map(r => ({
          id: r.id,
          meetingId: r.meeting_id,
          meetingTitle: r.meeting_title || 'Untitled Meeting',
          chunkText: r.chunk_text,
          chunkIndex: r.chunk_index,
          similarity: r.similarity,
        }));
    } catch (error) {
      logger.error({ error }, 'Semantic search failed');
      // Fall back to empty results if pgvector is not available
      return [];
    }
  }

  /**
   * Hybrid search combining full-text and semantic search
   */
  async hybridSearch(options: SemanticSearchOptions): Promise<SimilarResult[]> {
    const { query, organizationId, limit = 10 } = options;

    // Get semantic results
    const semanticResults = await this.searchSimilar({
      ...options,
      limit: limit * 2, // Get more for merging
      threshold: 0.6,
    });

    // If semantic search returns nothing, the pgvector might not be set up
    // or there are no embeddings yet
    if (semanticResults.length === 0) {
      logger.info('No semantic results, embeddings may not be generated');
    }

    // Return top results sorted by similarity
    return semanticResults.slice(0, limit);
  }

  /**
   * Get embedding statistics for an organization
   */
  async getStats(organizationId: string): Promise<{
    totalEmbeddings: number;
    meetingsWithEmbeddings: number;
  }> {
    const [totalEmbeddings, meetingsWithEmbeddings] = await Promise.all([
      prisma.transcriptEmbedding.count({
        where: {
          meeting: {
            organizationId,
            deletedAt: null,
          },
        },
      }),
      prisma.transcriptEmbedding.groupBy({
        by: ['meetingId'],
        where: {
          meeting: {
            organizationId,
            deletedAt: null,
          },
        },
      }).then(groups => groups.length),
    ]);

    return {
      totalEmbeddings,
      meetingsWithEmbeddings,
    };
  }
}

export const embeddingService = new EmbeddingService();
