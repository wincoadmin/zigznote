/**
 * Meeting Chat Service Tests
 */

import { prisma } from '@zigznote/database';

// Mock Prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    meetingChat: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    meeting: {
      findUnique: jest.fn(),
    },
    suggestedQuestion: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(prisma)),
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
    anthropicApiKey: 'test-anthropic-key',
    openaiApiKey: 'test-openai-key',
  },
}));

// Mock embedding service
jest.mock('./embeddingService', () => ({
  embeddingService: {
    getContextChunks: jest.fn(),
    crossMeetingSearch: jest.fn(),
  },
}));

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'AI response based on context' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'GPT response' } }],
    usage: { total_tokens: 150 },
  });
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

// Import AFTER mocks
import { MeetingChatService } from './meetingChatService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MeetingChatService', () => {
  let service: MeetingChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MeetingChatService();
  });

  describe('createChat', () => {
    it('should create a new chat session', async () => {
      const chatId = 'chat-123';
      (mockPrisma.meetingChat.create as jest.Mock).mockResolvedValue({ id: chatId });

      const result = await service.createChat({
        organizationId: 'org-1',
        userId: 'user-1',
        meetingId: 'meeting-1',
        title: 'Test Chat',
      });

      expect(result).toBe(chatId);
      expect(mockPrisma.meetingChat.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          meetingId: 'meeting-1',
          title: 'Test Chat',
        },
      });
    });

    it('should create a cross-meeting chat without meetingId', async () => {
      (mockPrisma.meetingChat.create as jest.Mock).mockResolvedValue({ id: 'chat-456' });

      await service.createChat({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      expect(mockPrisma.meetingChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meetingId: undefined,
        }),
      });
    });
  });

  describe('getUserChats', () => {
    it('should return user chats with message count', async () => {
      const mockDate = new Date();
      const mockChats = [
        {
          id: 'chat-1',
          title: 'Chat 1',
          meetingId: 'meeting-1',
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: { messages: 5 },
          messages: [{ createdAt: mockDate }],
        },
      ];
      (mockPrisma.meetingChat.findMany as jest.Mock).mockResolvedValue(mockChats);

      const result = await service.getUserChats('user-1', 'org-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('chat-1');
      expect(result[0].messageCount).toBe(5);
    });

    it('should filter by meetingId', async () => {
      const mockDate = new Date();
      (mockPrisma.meetingChat.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'chat-1',
          title: null,
          meetingId: 'meeting-123',
          createdAt: mockDate,
          _count: { messages: 0 },
          messages: [],
        },
      ]);

      await service.getUserChats('user-1', 'org-1', { meetingId: 'meeting-123' });

      expect(mockPrisma.meetingChat.findMany).toHaveBeenCalled();
    });
  });

  describe('getChatHistory', () => {
    it('should return chat messages', async () => {
      const mockChat = {
        id: 'chat-1',
        userId: 'user-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', citations: null, model: null, tokens: null, latencyMs: null, createdAt: new Date() },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi!',
            citations: [{ text: 'source' }],
            model: 'claude',
            tokens: 100,
            latencyMs: 500,
            createdAt: new Date(),
          },
        ],
      };
      (mockPrisma.meetingChat.findFirst as jest.Mock).mockResolvedValue(mockChat);

      const result = await service.getChatHistory('chat-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].citations).toEqual([{ text: 'source' }]);
    });

    it('should throw if chat not found', async () => {
      (mockPrisma.meetingChat.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getChatHistory('invalid', 'user-1')).rejects.toThrow(
        'Chat not found'
      );
    });
  });

  describe('deleteChat', () => {
    it('should delete a chat and its messages', async () => {
      (mockPrisma.meetingChat.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.deleteChat('chat-1', 'user-1');

      expect(mockPrisma.meetingChat.deleteMany).toHaveBeenCalledWith({
        where: { id: 'chat-1', userId: 'user-1' },
      });
    });
  });

  describe('getMeetingSuggestions', () => {
    it('should return existing suggestions', async () => {
      const mockSuggestions = [
        { question: 'What decisions were made?' },
        { question: 'Who has action items?' },
      ];
      (mockPrisma.suggestedQuestion.findMany as jest.Mock).mockResolvedValue(
        mockSuggestions
      );

      const result = await service.getMeetingSuggestions('meeting-1');

      expect(result).toEqual([
        'What decisions were made?',
        'Who has action items?',
      ]);
    });

    it('should generate suggestions if none exist', async () => {
      (mockPrisma.suggestedQuestion.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.meeting.findUnique as jest.Mock).mockResolvedValue({
        id: 'meeting-1',
        title: 'Test Meeting',
        summary: { content: 'Summary content' },
        actionItems: [{ id: 'ai-1', content: 'Do something' }],
      });
      (mockPrisma.suggestedQuestion.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.suggestedQuestion.createMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.getMeetingSuggestions('meeting-1');

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
