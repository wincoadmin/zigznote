import { Server as HttpServer, createServer } from 'http';
import { Express } from 'express';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import {
  initWebSocketServer,
  closeWebSocketServer,
  emitBotStatus,
  emitTranscriptChunk,
  emitTranscriptComplete,
  emitSummaryComplete,
  getMeetingRoom,
} from '../src/websocket';

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
  clerkAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('@zigznote/database');

describe('WebSocket Server', () => {
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  const PORT = 3099;

  beforeAll((done) => {
    const app = createApp();
    httpServer = createServer(app);
    initWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
      done();
    });
  });

  afterAll(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    await closeWebSocketServer();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach((done) => {
    clientSocket = ioc(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    clientSocket.on('connect', () => {
      done();
    });

    clientSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      done(err);
    });
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should establish WebSocket connection', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  describe('Room Management', () => {
    it('should join meeting room', (done) => {
      const meetingId = 'test-meeting-123';

      clientSocket.emit('join:meeting', meetingId);

      // Give time for the room join to process
      setTimeout(() => {
        // Socket should be in the meeting room
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });

    it('should leave meeting room', (done) => {
      const meetingId = 'test-meeting-456';

      clientSocket.emit('join:meeting', meetingId);

      setTimeout(() => {
        clientSocket.emit('leave:meeting', meetingId);
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Event Broadcasting', () => {
    it('should receive bot status events', (done) => {
      const meetingId = 'test-meeting-789';

      clientSocket.emit('join:meeting', meetingId);

      clientSocket.on('bot.status', (data) => {
        expect(data.meetingId).toBe(meetingId);
        expect(data.status).toBe('recording');
        done();
      });

      setTimeout(() => {
        emitBotStatus({
          meetingId,
          botId: 'bot-123',
          status: 'recording',
          timestamp: new Date().toISOString(),
        });
      }, 100);
    });

    it('should receive transcript chunk events', (done) => {
      const meetingId = 'test-meeting-transcript';

      clientSocket.emit('join:meeting', meetingId);

      clientSocket.on('transcript.chunk', (data) => {
        expect(data.meetingId).toBe(meetingId);
        expect(data.chunks.length).toBe(1);
        expect(data.chunks[0].text).toBe('Hello world');
        done();
      });

      setTimeout(() => {
        emitTranscriptChunk({
          meetingId,
          chunks: [
            {
              speaker: 'Speaker 1',
              text: 'Hello world',
              startMs: 0,
              endMs: 1000,
              confidence: 0.95,
            },
          ],
          timestamp: new Date().toISOString(),
        });
      }, 100);
    });

    it('should receive transcript complete events', (done) => {
      const meetingId = 'test-meeting-complete';

      clientSocket.emit('join:meeting', meetingId);

      clientSocket.on('transcript.complete', (data) => {
        expect(data.meetingId).toBe(meetingId);
        expect(data.transcriptId).toBe('transcript-123');
        expect(data.wordCount).toBe(500);
        done();
      });

      setTimeout(() => {
        emitTranscriptComplete({
          meetingId,
          transcriptId: 'transcript-123',
          wordCount: 500,
          speakerCount: 2,
          durationMs: 3600000,
          timestamp: new Date().toISOString(),
        });
      }, 100);
    });

    it('should receive summary complete events', (done) => {
      const meetingId = 'test-meeting-summary';

      clientSocket.emit('join:meeting', meetingId);

      clientSocket.on('summary.complete', (data) => {
        expect(data.meetingId).toBe(meetingId);
        expect(data.summaryId).toBe('summary-123');
        expect(data.actionItemCount).toBe(5);
        done();
      });

      setTimeout(() => {
        emitSummaryComplete({
          meetingId,
          summaryId: 'summary-123',
          actionItemCount: 5,
          timestamp: new Date().toISOString(),
        });
      }, 100);
    });

    it('should not receive events from other meeting rooms', (done) => {
      const joinedMeetingId = 'meeting-joined';
      const otherMeetingId = 'meeting-other';

      clientSocket.emit('join:meeting', joinedMeetingId);

      let receivedEvent = false;

      clientSocket.on('bot.status', () => {
        receivedEvent = true;
      });

      setTimeout(() => {
        emitBotStatus({
          meetingId: otherMeetingId,
          botId: 'bot-other',
          status: 'recording',
          timestamp: new Date().toISOString(),
        });
      }, 100);

      setTimeout(() => {
        expect(receivedEvent).toBe(false);
        done();
      }, 300);
    });
  });

  describe('Room Name Helpers', () => {
    it('should format meeting room name correctly', () => {
      const room = getMeetingRoom('meeting-123');
      expect(room).toBe('meeting:meeting-123');
    });
  });
});
