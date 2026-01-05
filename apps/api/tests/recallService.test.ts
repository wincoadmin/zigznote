import { recallService } from '../src/services/recallService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the jobs module
jest.mock('../src/jobs', () => ({
  addTranscriptionJob: jest.fn(),
}));

// Mock the database module
jest.mock('@zigznote/database', () => ({
  meetingRepository: {
    findByBotId: jest.fn(),
    update: jest.fn(),
  },
  prisma: {
    meeting: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

// Mock WebSocket module
jest.mock('../src/websocket', () => ({
  emitBotStatus: jest.fn(),
  emitTranscriptChunk: jest.fn(),
}));

describe('RecallService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('parseJoinUrl', () => {
    it('should parse standard Zoom URL', () => {
      const result = recallService.parseJoinUrl('https://zoom.us/j/123456789');
      expect(result.platform).toBe('zoom');
      expect(result.meetingId).toBe('123456789');
    });

    it('should parse Zoom URL with password', () => {
      const result = recallService.parseJoinUrl('https://zoom.us/j/123456789?pwd=abc123');
      expect(result.platform).toBe('zoom');
      expect(result.meetingId).toBe('123456789');
      expect(result.password).toBe('abc123');
    });

    it('should parse Zoom URL with subdomain', () => {
      const result = recallService.parseJoinUrl('https://us02web.zoom.us/j/123456789');
      expect(result.platform).toBe('zoom');
      expect(result.meetingId).toBe('123456789');
    });

    it('should parse Zoom URL with company subdomain', () => {
      const result = recallService.parseJoinUrl('https://company.zoom.us/j/123456789');
      expect(result.platform).toBe('zoom');
      expect(result.meetingId).toBe('123456789');
    });

    it('should parse zoommtg protocol URL', () => {
      const result = recallService.parseJoinUrl('zoommtg://zoom.us/join?confno=123456789');
      expect(result.platform).toBe('zoom');
      expect(result.meetingId).toBe('123456789');
    });

    it('should parse Google Meet URL', () => {
      const result = recallService.parseJoinUrl('https://meet.google.com/abc-defg-hij');
      expect(result.platform).toBe('meet');
      expect(result.meetingId).toBe('abc-defg-hij');
    });

    it('should parse Google Meet URL with query params', () => {
      const result = recallService.parseJoinUrl('https://meet.google.com/abc-defg-hij?authuser=0');
      expect(result.platform).toBe('meet');
      expect(result.meetingId).toBe('abc-defg-hij');
    });

    it('should parse Microsoft Teams URL', () => {
      const result = recallService.parseJoinUrl('https://teams.microsoft.com/l/meetup-join/...');
      expect(result.platform).toBe('teams');
    });

    it('should parse Webex URL', () => {
      const result = recallService.parseJoinUrl('https://company.webex.com/meet/...');
      expect(result.platform).toBe('webex');
    });

    it('should return other for unknown URL', () => {
      const result = recallService.parseJoinUrl('https://example.com/meeting');
      expect(result.platform).toBe('other');
    });
  });

  describe('extractPasswordFromBody', () => {
    it('should extract password with "Password:" format', () => {
      const result = recallService.extractPasswordFromBody('Join meeting\nPassword: abc123\nThanks');
      expect(result).toBe('abc123');
    });

    it('should extract password with "Passcode:" format', () => {
      const result = recallService.extractPasswordFromBody('Meeting passcode: 123456');
      expect(result).toBe('123456');
    });

    it('should extract password with "Meeting password is:" format', () => {
      const result = recallService.extractPasswordFromBody('Meeting password is: xyz789');
      expect(result).toBe('xyz789');
    });

    it('should extract password with "Pin:" format', () => {
      const result = recallService.extractPasswordFromBody('Pin: 9999');
      expect(result).toBe('9999');
    });

    it('should return undefined when no password found', () => {
      const result = recallService.extractPasswordFromBody('Join the meeting at 2pm');
      expect(result).toBeUndefined();
    });
  });

  describe('createBot', () => {
    it('should create a bot with correct payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'ready',
        }),
      });

      const result = await recallService.createBot({
        meetingUrl: 'https://zoom.us/j/123456789',
        botName: 'Test Bot',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bot'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('meeting_url'),
        })
      );

      expect(result.id).toBe('bot-123');
      expect(result.status).toBe('ready');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid meeting URL',
      });

      await expect(
        recallService.createBot({ meetingUrl: 'invalid' })
      ).rejects.toThrow('Bot creation failed');
    });
  });

  describe('getBotStatus', () => {
    it('should return bot status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'in_call_recording',
          meeting_url: 'https://zoom.us/j/123456789',
          joined_at: '2024-01-01T12:00:00Z',
          recording: true,
        }),
      });

      const result = await recallService.getBotStatus('bot-123');

      expect(result.id).toBe('bot-123');
      expect(result.status).toBe('in_call');
      expect(result.recordingAvailable).toBe(true);
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(recallService.getBotStatus('not-found')).rejects.toThrow('Bot not found');
    });
  });

  describe('stopBot', () => {
    it('should make DELETE request to stop bot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await recallService.stopBot('bot-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bot/bot-123/leave_call'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should not throw on 404 (already stopped)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(recallService.stopBot('bot-123')).resolves.not.toThrow();
    });
  });

  describe('getRecording', () => {
    it('should return recording info when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://storage.example.com/recording.mp4',
          duration_ms: 3600000,
          format: 'mp4',
          expires_at: '2024-12-31T23:59:59Z',
        }),
      });

      const result = await recallService.getRecording('bot-123');

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://storage.example.com/recording.mp4');
      expect(result?.durationMs).toBe(3600000);
    });

    it('should return null when recording not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await recallService.getRecording('bot-123');
      expect(result).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return false when secret is not configured', () => {
      // The service uses empty string as default, so this should work
      const result = recallService.verifyWebhookSignature('payload', 'signature');
      expect(result).toBe(false);
    });
  });
});
