/**
 * WebSocket server for real-time updates
 * Uses Socket.IO for connection management and room-based broadcasting
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { config } from '../config';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  BotStatusEvent,
  TranscriptChunkEvent,
  TranscriptCompleteEvent,
  SummaryCompleteEvent,
  MeetingUpdatedEvent,
} from './types';
import { getMeetingRoom, getOrganizationRoom, getUserRoom } from './types';

// Type-safe Socket.IO server
type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Singleton instance
let io: TypedServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(httpServer: HttpServer): TypedServer {
  if (io) {
    return io;
  }

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Connection handler
  io.on('connection', (socket: TypedSocket) => {
    logger.info({ socketId: socket.id }, 'WebSocket client connected');

    // Initialize socket data
    socket.data.joinedRooms = new Set();

    // Handle joining a meeting room
    socket.on('join:meeting', (meetingId: string) => {
      const room = getMeetingRoom(meetingId);
      socket.join(room);
      socket.data.joinedRooms.add(room);
      logger.debug({ socketId: socket.id, meetingId, room }, 'Client joined meeting room');
    });

    // Handle leaving a meeting room
    socket.on('leave:meeting', (meetingId: string) => {
      const room = getMeetingRoom(meetingId);
      socket.leave(room);
      socket.data.joinedRooms.delete(room);
      logger.debug({ socketId: socket.id, meetingId, room }, 'Client left meeting room');
    });

    // Handle ping (for connection health check)
    socket.on('ping', () => {
      socket.emit('error', {
        code: 'PONG',
        message: 'Connection alive',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'WebSocket client disconnected');
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'WebSocket error');
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): TypedServer | null {
  return io;
}

/**
 * Broadcast bot status change to meeting room
 */
export function emitBotStatus(event: BotStatusEvent): void {
  if (!io) return;

  const room = getMeetingRoom(event.meetingId);
  io.to(room).emit('bot.status', event);
  logger.debug({ room, status: event.status }, 'Emitted bot.status event');
}

/**
 * Broadcast transcript chunks to meeting room
 */
export function emitTranscriptChunk(event: TranscriptChunkEvent): void {
  if (!io) return;

  const room = getMeetingRoom(event.meetingId);
  io.to(room).emit('transcript.chunk', event);
  logger.debug({ room, chunkCount: event.chunks.length }, 'Emitted transcript.chunk event');
}

/**
 * Broadcast transcript completion to meeting room
 */
export function emitTranscriptComplete(event: TranscriptCompleteEvent): void {
  if (!io) return;

  const room = getMeetingRoom(event.meetingId);
  io.to(room).emit('transcript.complete', event);
  logger.debug({ room, transcriptId: event.transcriptId }, 'Emitted transcript.complete event');
}

/**
 * Broadcast summary completion to meeting room
 */
export function emitSummaryComplete(event: SummaryCompleteEvent): void {
  if (!io) return;

  const room = getMeetingRoom(event.meetingId);
  io.to(room).emit('summary.complete', event);
  logger.debug({ room, summaryId: event.summaryId }, 'Emitted summary.complete event');
}

/**
 * Broadcast meeting update to meeting room
 */
export function emitMeetingUpdated(event: MeetingUpdatedEvent): void {
  if (!io) return;

  const room = getMeetingRoom(event.meetingId);
  io.to(room).emit('meeting.updated', event);
  logger.debug({ room, status: event.status }, 'Emitted meeting.updated event');
}

/**
 * Send error to specific user
 */
export function emitErrorToUser(userId: string, code: string, message: string): void {
  if (!io) return;

  const room = getUserRoom(userId);
  io.to(room).emit('error', {
    code,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast to organization room
 */
export function emitToOrganization(organizationId: string, event: string, data: unknown): void {
  if (!io) return;

  const room = getOrganizationRoom(organizationId);
  (io.to(room) as any).emit(event, data);
}

/**
 * Get room statistics
 */
export async function getRoomStats(): Promise<{
  totalConnections: number;
  rooms: Map<string, number>;
}> {
  if (!io) {
    return { totalConnections: 0, rooms: new Map() };
  }

  const sockets = await io.fetchSockets();
  const rooms = new Map<string, number>();

  for (const socket of sockets) {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        // Exclude default room
        rooms.set(room, (rooms.get(room) || 0) + 1);
      }
    }
  }

  return {
    totalConnections: sockets.length,
    rooms,
  };
}

/**
 * Close WebSocket server
 */
export async function closeWebSocketServer(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
    logger.info('WebSocket server closed');
  }
}
