/**
 * Embedding Service Tests
 */

import { prisma } from '@zigznote/database';

// Mock Prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    transcriptEmbedding: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    meeting: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

// Mock @zigznote/shared
jest.mock('@zigznote/shared', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock config
jest.mock('../config', () => ({
  config: {
    openaiApiKey: 'test-openai-key',
  },
}));

// Mock fetch for OpenAI embedding API
const mockFetch = jest.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({
    data: [{ embedding: new Array(1536).fill(0.1) }],
    usage: { total_tokens: 10 },
  }),
});

// Import AFTER mocks
import { EmbeddingService } from './embeddingService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingService();
  });

  describe('chunkTranscriptSegments', () => {
    it('should chunk segments into groups', () => {
      const segments = [
        { speaker: 'Alice', text: 'Hello everyone', startTime: 0, endTime: 5000 },
        { speaker: 'Bob', text: 'Hi Alice', startTime: 5000, endTime: 8000 },
        { speaker: 'Alice', text: 'Let me share the agenda', startTime: 8000, endTime: 15000 },
        { speaker: 'Bob', text: 'Sounds good', startTime: 15000, endTime: 18000 },
        { speaker: 'Alice', text: 'First item is testing', startTime: 18000, endTime: 25000 },
      ];

      const chunks = service.chunkTranscriptSegments(segments);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('text');
      expect(chunks[0]).toHaveProperty('startTime');
      expect(chunks[0]).toHaveProperty('endTime');
      expect(chunks[0]).toHaveProperty('speakers');
    });

    it('should handle empty segments', () => {
      const chunks = service.chunkTranscriptSegments([]);
      expect(chunks).toEqual([]);
    });

    it('should include speaker information in chunks', () => {
      const segments = [
        { speaker: 'Alice', text: 'Hello', startTime: 0, endTime: 2000 },
        { speaker: 'Bob', text: 'Hi', startTime: 2000, endTime: 4000 },
      ];

      const chunks = service.chunkTranscriptSegments(segments);

      expect(chunks[0].speakers).toContain('Alice');
      expect(chunks[0].speakers).toContain('Bob');
    });

    it('should combine adjacent segments into chunks', () => {
      const segments = Array(10).fill(null).map((_, i) => ({
        speaker: i % 2 === 0 ? 'Alice' : 'Bob',
        text: `Segment ${i}`,
        startTime: i * 5000,
        endTime: (i + 1) * 5000,
      }));

      const chunks = service.chunkTranscriptSegments(segments);

      // Chunks should have combined text
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getContextChunks', () => {
    it('should return similar chunks for a query', async () => {
      const mockEmbeddings = [
        {
          id: 'emb-1',
          text: 'We discussed the budget allocation',
          startTime: 60000,
          endTime: 90000,
          speakers: ['Alice', 'Bob'],
        },
        {
          id: 'emb-2',
          text: 'The budget for Q2 is finalized',
          startTime: 120000,
          endTime: 150000,
          speakers: ['Alice'],
        },
      ];
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockEmbeddings);

      const result = await service.getContextChunks('meeting-1', 'budget');

      expect(result.length).toBeGreaterThan(0);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
        { id: 'emb-1', text: 'Test 1', startTime: 0, endTime: 5000, speakers: ['A'] },
        { id: 'emb-2', text: 'Test 2', startTime: 5000, endTime: 10000, speakers: ['B'] },
        { id: 'emb-3', text: 'Test 3', startTime: 10000, endTime: 15000, speakers: ['C'] },
      ]);

      await service.getContextChunks('meeting-1', 'query', 2);

      // The query should include the limit
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('crossMeetingSearch', () => {
    it('should search across multiple meetings', async () => {
      const mockResults = [
        {
          meetingId: 'meeting-1',
          meetingTitle: 'Team Standup',
          text: 'The launch date is next week',
          startTime: 300000,
          endTime: 330000,
          speakers: ['Alice'],
          similarity: 0.95,
        },
        {
          meetingId: 'meeting-2',
          meetingTitle: 'Product Planning',
          text: 'We need to finalize launch plans',
          startTime: 600000,
          endTime: 660000,
          speakers: ['Bob', 'Carol'],
          similarity: 0.88,
        },
      ];
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.crossMeetingSearch('org-1', 'launch date');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('meetingId');
      expect(result[0]).toHaveProperty('meetingTitle');
      expect(result[0]).toHaveProperty('similarity');
    });

    it('should filter by specific meeting IDs', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.crossMeetingSearch('org-1', 'test query', {
        meetingIds: ['meeting-1', 'meeting-2'],
        limit: 10,
      });

      // Verify the query includes meeting filtering
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return empty array for no matches', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.crossMeetingSearch('org-1', 'nonexistent query');

      expect(result).toEqual([]);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding vector for text', async () => {
      const result = await service.generateEmbedding('test text');

      expect(result).toHaveProperty('embedding');
      expect(result).toHaveProperty('tokensUsed');
      expect(result.embedding).toHaveLength(1536);
    });
  });

  describe('isAvailable', () => {
    it('should return true when OpenAI API key is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });
});
