import request from 'supertest';
import { createApp } from '../src/app';

// Mock the database module
jest.mock('@zigznote/database', () => {
  const mockMeetings = new Map();

  return {
    meetingRepository: {
      findById: jest.fn((id) => mockMeetings.get(id)),
      findByBotId: jest.fn(),
      update: jest.fn((id, data) => {
        const meeting = mockMeetings.get(id);
        if (meeting) {
          const updated = { ...meeting, ...data };
          mockMeetings.set(id, updated);
          return updated;
        }
        return null;
      }),
      create: jest.fn((data) => {
        const meeting = { id: 'meeting-123', ...data, status: 'scheduled' };
        mockMeetings.set(meeting.id, meeting);
        return meeting;
      }),
    },
    // Add mock for meetings list
    prisma: {
      meeting: {
        findMany: jest.fn(() => []),
        count: jest.fn(() => 0),
      },
    },
  };
});

// Mock the auth middleware
jest.mock('../src/middleware/auth', () => {
  const originalModule = jest.requireActual('../src/middleware/auth');
  return {
    ...originalModule,
    clerkAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireAuth: (req: { auth?: Record<string, string> }, _res: unknown, next: () => void) => {
      req.auth = {
        userId: 'test-user-id',
        clerkUserId: 'clerk-test-user-id',
        organizationId: 'test-org-id',
        email: 'test@example.com',
        role: 'member',
      };
      next();
    },
  };
});

// Mock the RecallService
jest.mock('../src/services/recallService', () => ({
  recallService: {
    createBot: jest.fn(),
    getBotStatus: jest.fn(),
    stopBot: jest.fn(),
    getRecording: jest.fn(),
  },
}));

// Get a reference to the mocked service
import { recallService } from '../src/services/recallService';
const mockRecallService = recallService as jest.Mocked<typeof recallService>;

// Mock the meeting service
jest.mock('../src/services/meetingService', () => {
  const { NotFoundError } = jest.requireActual('@zigznote/shared');
  return {
    meetingService: {
      getById: jest.fn().mockImplementation((id, orgId) => {
        if (id === 'meeting-123') {
          return {
            id: 'meeting-123',
            organizationId: orgId,
            title: 'Test Meeting',
            meetingUrl: 'https://zoom.us/j/123456789',
            botId: null,
            status: 'scheduled',
          };
        }
        if (id === 'meeting-with-bot') {
          return {
            id: 'meeting-with-bot',
            organizationId: orgId,
            title: 'Meeting with Bot',
            meetingUrl: 'https://zoom.us/j/123456789',
            botId: 'bot-existing',
            status: 'recording',
          };
        }
        throw new NotFoundError('Meeting not found');
      }),
    },
  };
});

describe('Bot Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/meetings/:id/bot', () => {
    it('should create a bot for a meeting', async () => {
      mockRecallService.createBot.mockResolvedValueOnce({
        id: 'bot-new-123',
        status: 'ready',
      });

      const response = await request(app)
        .post('/api/v1/meetings/meeting-123/bot')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.botId).toBe('bot-new-123');
      expect(mockRecallService.createBot).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingUrl: 'https://zoom.us/j/123456789',
        })
      );
    });

    it('should return existing bot if already created', async () => {
      mockRecallService.getBotStatus.mockResolvedValueOnce({
        id: 'bot-existing',
        status: 'in_call',
        recordingAvailable: false,
      });

      const response = await request(app)
        .post('/api/v1/meetings/meeting-with-bot/bot')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.botId).toBe('bot-existing');
      expect(response.body.data.message).toBe('Bot already exists for this meeting');
      expect(mockRecallService.createBot).not.toHaveBeenCalled();
    });

    it('should accept custom bot name', async () => {
      mockRecallService.createBot.mockResolvedValueOnce({
        id: 'bot-custom',
        status: 'ready',
      });

      const response = await request(app)
        .post('/api/v1/meetings/meeting-123/bot')
        .send({ botName: 'Custom Bot Name' });

      expect(response.status).toBe(201);
      expect(mockRecallService.createBot).toHaveBeenCalledWith(
        expect.objectContaining({
          botName: 'Custom Bot Name',
        })
      );
    });

    it('should return 404 for non-existent meeting', async () => {
      const response = await request(app)
        .post('/api/v1/meetings/non-existent/bot')
        .send({});

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/meetings/:id/bot', () => {
    it('should return bot status', async () => {
      mockRecallService.getBotStatus.mockResolvedValueOnce({
        id: 'bot-existing',
        status: 'in_call',
        joinedAt: new Date('2024-01-01T12:00:00Z'),
        recordingAvailable: false,
      });

      const response = await request(app)
        .get('/api/v1/meetings/meeting-with-bot/bot');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.botId).toBe('bot-existing');
      expect(response.body.data.status).toBe('in_call');
    });

    it('should include recording info if available', async () => {
      mockRecallService.getBotStatus.mockResolvedValueOnce({
        id: 'bot-existing',
        status: 'ended',
        recordingAvailable: true,
      });
      mockRecallService.getRecording.mockResolvedValueOnce({
        url: 'https://storage.example.com/recording.mp4',
        durationMs: 3600000,
      });

      const response = await request(app)
        .get('/api/v1/meetings/meeting-with-bot/bot');

      expect(response.status).toBe(200);
      expect(response.body.data.recording).not.toBeNull();
      expect(response.body.data.recording.url).toBe('https://storage.example.com/recording.mp4');
    });

    it('should return 404 if no bot for meeting', async () => {
      const response = await request(app)
        .get('/api/v1/meetings/meeting-123/bot');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/meetings/:id/bot', () => {
    it('should stop the bot', async () => {
      mockRecallService.stopBot.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/v1/meetings/meeting-with-bot/bot');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockRecallService.stopBot).toHaveBeenCalledWith('bot-existing');
    });

    it('should return 404 if no bot for meeting', async () => {
      const response = await request(app)
        .delete('/api/v1/meetings/meeting-123/bot');

      expect(response.status).toBe(404);
    });
  });
});
