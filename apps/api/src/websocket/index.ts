/**
 * WebSocket module exports
 */

export {
  initWebSocketServer,
  getWebSocketServer,
  emitBotStatus,
  emitTranscriptChunk,
  emitTranscriptComplete,
  emitSummaryComplete,
  emitMeetingUpdated,
  emitErrorToUser,
  emitToOrganization,
  getRoomStats,
  closeWebSocketServer,
} from './server';

export type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  BotStatusEvent,
  TranscriptChunkEvent,
  TranscriptCompleteEvent,
  SummaryCompleteEvent,
  MeetingUpdatedEvent,
  ErrorEvent,
} from './types';

export {
  getMeetingRoom,
  getOrganizationRoom,
  getUserRoom,
} from './types';
