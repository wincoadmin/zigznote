/**
 * Chat Routes Tests
 */

import request from 'supertest';
import express from 'express';
import chatRouter from './chat';
import { meetingChatService, embeddingService } from '../services';

// Mock services
jest.mock('../services', () => ({
  meetingChatService: {
    createChat: jest.fn(),
    getUserChats: jest.fn(),
    getChatHistory: jest.fn(),
    sendMessage: jest.fn(),
    deleteChat: jest.fn(),
    getMeetingSuggestions: jest.fn(),
  },
  embeddingService: {
    crossMeetingSearch: jest.fn(),
  },
}));

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  AuthenticatedRequest: {},
}));

// Mock validateRequest middleware
jest.mock('../middleware/validateRequest', () => ({
  validateRequest: () => (req: any, _res: any, next: any) => next(),
}));

// Mock utils/errors
jest.mock('../utils/errors', () => ({
  AppError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
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

const mockMeetingChatService = meetingChatService as jest.Mocked<typeof meetingChatService>;
const mockEmbeddingService = embeddingService as jest.Mocked<typeof embeddingService>;

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, _res, next) => {
  req.auth = {
    userId: 'user-123',
    organizationId: 'org-123',
  };
  next();
});

app.use('/api/v1/chat', chatRouter);

describe('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat', () => {
    it('should create a new chat session', async () => {
      const chatId = 'chat-123';
      mockMeetingChatService.createChat.mockResolvedValue(chatId);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({ meetingId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { chatId },
      });
      expect(mockMeetingChatService.createChat).toHaveBeenCalledWith({
        organizationId: 'org-123',
        userId: 'user-123',
        meetingId: '550e8400-e29b-41d4-a716-446655440000',
        title: undefined,
      });
    });

    it('should create a cross-meeting chat without meetingId', async () => {
      const chatId = 'chat-456';
      mockMeetingChatService.createChat.mockResolvedValue(chatId);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.data.chatId).toBe(chatId);
    });
  });

  describe('GET /api/v1/chat', () => {
    it('should return user chat sessions', async () => {
      const chats = [
        {
          id: 'chat-1',
          title: 'Chat 1',
          meetingId: 'meeting-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { messages: 5 },
        },
      ];
      mockMeetingChatService.getUserChats.mockResolvedValue(chats);

      const response = await request(app).get('/api/v1/chat');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(chats);
    });

    it('should filter by meetingId', async () => {
      mockMeetingChatService.getUserChats.mockResolvedValue([]);

      await request(app).get('/api/v1/chat?meetingId=meeting-123');

      expect(mockMeetingChatService.getUserChats).toHaveBeenCalledWith(
        'user-123',
        'org-123',
        { meetingId: 'meeting-123', limit: undefined }
      );
    });
  });

  describe('GET /api/v1/chat/:chatId', () => {
    it('should return chat history', async () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          citations: [],
          createdAt: new Date().toISOString(),
        },
      ];
      mockMeetingChatService.getChatHistory.mockResolvedValue(messages);

      const response = await request(app).get(
        '/api/v1/chat/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(messages);
    });

  });

  describe('POST /api/v1/chat/:chatId/messages', () => {
    it('should send a message and return AI response', async () => {
      const chatResponse = {
        message: {
          id: 'msg-123',
          role: 'assistant',
          content: 'Based on the transcript, here are the key points...',
          citations: [
            {
              meetingId: 'meeting-1',
              meetingTitle: 'Team Standup',
              timestamp: 120,
              text: 'We need to focus on testing',
              relevance: 0.95,
            },
          ],
          createdAt: new Date().toISOString(),
        },
        suggestedFollowups: ['What were the action items?'],
      };
      mockMeetingChatService.sendMessage.mockResolvedValue(chatResponse);

      const response = await request(app)
        .post('/api/v1/chat/550e8400-e29b-41d4-a716-446655440000/messages')
        .send({ message: 'What was discussed?' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(chatResponse);
    });

  });

  describe('DELETE /api/v1/chat/:chatId', () => {
    it('should delete a chat', async () => {
      mockMeetingChatService.deleteChat.mockResolvedValue(undefined);

      const response = await request(app).delete(
        '/api/v1/chat/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(200);
      expect(response.body.data.deleted).toBe(true);
    });
  });

  describe('POST /api/v1/chat/search', () => {
    it('should perform cross-meeting semantic search', async () => {
      const searchResults = [
        {
          meetingId: 'meeting-1',
          meetingTitle: 'Product Planning',
          text: 'We decided to launch in Q2',
          startTime: 300,
          speakers: ['Alice', 'Bob'],
          similarity: 0.92,
        },
      ];
      mockEmbeddingService.crossMeetingSearch.mockResolvedValue(searchResults);

      const response = await request(app)
        .post('/api/v1/chat/search')
        .send({ query: 'launch timeline' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(searchResults);
    });

    it('should filter by meeting IDs', async () => {
      mockEmbeddingService.crossMeetingSearch.mockResolvedValue([]);

      await request(app)
        .post('/api/v1/chat/search')
        .send({
          query: 'search term',
          meetingIds: ['550e8400-e29b-41d4-a716-446655440000'],
          limit: 10,
        });

      expect(mockEmbeddingService.crossMeetingSearch).toHaveBeenCalledWith(
        'org-123',
        'search term',
        {
          meetingIds: ['550e8400-e29b-41d4-a716-446655440000'],
          limit: 10,
        }
      );
    });
  });

  describe('GET /api/v1/chat/meetings/:meetingId/suggestions', () => {
    it('should return suggested questions for a meeting', async () => {
      const suggestions = [
        'What were the key decisions?',
        'Who has action items?',
        'What was the deadline discussed?',
      ];
      mockMeetingChatService.getMeetingSuggestions.mockResolvedValue(suggestions);

      const response = await request(app).get(
        '/api/v1/chat/meetings/550e8400-e29b-41d4-a716-446655440000/suggestions'
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(suggestions);
    });
  });
});
