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
}));

// Mock WebSocket module
jest.mock('../src/websocket', () => ({
  emitBotStatus: jest.fn(),
  emitTranscriptChunk: jest.fn(),
}));

describe('Meeting Bot Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('URL Parsing Edge Cases', () => {
    it('should handle all Zoom URL formats', () => {
      const urls = [
        { url: 'https://zoom.us/j/123456789', expectedId: '123456789' },
        { url: 'https://zoom.us/j/123456789?pwd=xxx', expectedId: '123456789' },
        { url: 'https://us02web.zoom.us/j/123456789', expectedId: '123456789' },
        { url: 'https://company.zoom.us/j/123456789', expectedId: '123456789' },
        { url: 'zoommtg://zoom.us/join?confno=123456789', expectedId: '123456789' },
      ];

      for (const { url, expectedId } of urls) {
        const result = recallService.parseJoinUrl(url);
        expect(result.platform).toBe('zoom');
        expect(result.meetingId).toBe(expectedId);
      }
    });

    it('should handle all Google Meet URL formats', () => {
      const urls = [
        { url: 'https://meet.google.com/abc-defg-hij', expectedId: 'abc-defg-hij' },
        { url: 'https://meet.google.com/abc-defg-hij?authuser=0', expectedId: 'abc-defg-hij' },
      ];

      for (const { url, expectedId } of urls) {
        const result = recallService.parseJoinUrl(url);
        expect(result.platform).toBe('meet');
        expect(result.meetingId).toBe(expectedId);
      }
    });

    it('should handle all Microsoft Teams URL formats', () => {
      const urls = [
        'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxx@thread.v2/0?context=%7b%22Tid%22%3a%22xxx%22%7d',
        'https://teams.live.com/meet/123456789',
      ];

      for (const url of urls) {
        const result = recallService.parseJoinUrl(url);
        expect(result.platform).toBe('teams');
      }
    });

    it('should extract password from various calendar formats', () => {
      const testCases = [
        { body: 'Password: abc123', expected: 'abc123' },
        { body: 'Passcode: 123456', expected: '123456' },
        { body: 'Meeting password is: xyz', expected: 'xyz' },
        { body: 'Pin: 9999', expected: '9999' },
        { body: 'Access code: secret123', expected: 'secret123' },
      ];

      for (const { body, expected } of testCases) {
        const result = recallService.extractPasswordFromBody(body);
        expect(result).toBe(expected);
      }
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'not-a-url',
        '',
        'http://',
        'https://',
        'zoom.us/j/123',
      ];

      for (const url of malformedUrls) {
        expect(() => recallService.parseJoinUrl(url)).not.toThrow();
        const result = recallService.parseJoinUrl(url);
        expect(result.platform).toBe('other');
      }
    });
  });

  describe('Bot Lifecycle Edge Cases', () => {
    it('should prevent duplicate bots in same meeting', async () => {
      // First call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'ready',
        }),
      });

      // Simulate race condition - second call tries while first is in progress
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'Bot already exists for this meeting',
      });

      const result1 = await recallService.createBot({
        meetingUrl: 'https://zoom.us/j/123456789',
      });

      expect(result1.id).toBe('bot-123');

      // Second call should fail
      await expect(
        recallService.createBot({ meetingUrl: 'https://zoom.us/j/123456789' })
      ).rejects.toThrow();
    });

    it('should handle bot timeout in waiting room', async () => {
      // This would be handled by the webhook - just verify the status mapping
      const waitingRoomStatuses = [
        'in_waiting_room',
      ];

      for (const status of waitingRoomStatuses) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'bot-123',
            status,
            meeting_url: 'https://zoom.us/j/123',
          }),
        });

        const result = await recallService.getBotStatus('bot-123');
        expect(result.status).toBe('joining');
      }
    });

    it('should handle bot being kicked gracefully', async () => {
      // Simulate kicked status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'call_ended',
          left_reason: 'kicked_by_host',
        }),
      });

      const result = await recallService.getBotStatus('bot-123');
      expect(result.status).toBe('ended');
    });

    it('should handle network errors during bot creation', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        recallService.createBot({ meetingUrl: 'https://zoom.us/j/123' })
      ).rejects.toThrow('Failed to create meeting bot');
    });

    it('should handle API rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        recallService.createBot({ meetingUrl: 'https://zoom.us/j/123' })
      ).rejects.toThrow();
    });
  });

  describe('Recording Edge Cases', () => {
    it('should handle recording not yet ready', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await recallService.getRecording('bot-123');
      expect(result).toBeNull();
    });

    it('should handle expired recording URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://storage.example.com/recording.mp4',
          duration_ms: 3600000,
          format: 'mp4',
          expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
        }),
      });

      const result = await recallService.getRecording('bot-123');
      expect(result).not.toBeNull();
      // Recording is still returned but expiration is in the past
      expect(result?.expiresAt.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    it('should handle Zoom waiting room', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'in_waiting_room',
        }),
      });

      const result = await recallService.getBotStatus('bot-123');
      expect(result.status).toBe('joining');
    });

    it('should handle Teams lobby', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'bot-123',
          status: 'in_waiting_room', // Teams uses same status
        }),
      });

      const result = await recallService.getBotStatus('bot-123');
      expect(result.status).toBe('joining');
    });
  });
});
