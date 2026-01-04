/**
 * WebSocket event types and interfaces
 */

/**
 * Server-to-client events
 */
export interface ServerToClientEvents {
  'bot.status': (data: BotStatusEvent) => void;
  'transcript.chunk': (data: TranscriptChunkEvent) => void;
  'transcript.complete': (data: TranscriptCompleteEvent) => void;
  'summary.complete': (data: SummaryCompleteEvent) => void;
  'meeting.updated': (data: MeetingUpdatedEvent) => void;
  'error': (data: ErrorEvent) => void;
}

/**
 * Client-to-server events
 */
export interface ClientToServerEvents {
  'join:meeting': (meetingId: string) => void;
  'leave:meeting': (meetingId: string) => void;
  'ping': () => void;
}

/**
 * Inter-server events (for horizontal scaling)
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Socket data (per-socket storage)
 */
export interface SocketData {
  userId: string;
  organizationId: string;
  joinedRooms: Set<string>;
}

/**
 * Bot status change event
 */
export interface BotStatusEvent {
  meetingId: string;
  botId: string;
  status: 'ready' | 'joining' | 'in_call' | 'recording' | 'leaving' | 'ended' | 'error' | 'waiting' | 'kicked';
  timestamp: string;
  errorMessage?: string;
}

/**
 * Real-time transcript chunk event
 */
export interface TranscriptChunkEvent {
  meetingId: string;
  chunks: Array<{
    speaker: string;
    text: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }>;
  timestamp: string;
}

/**
 * Transcript completed event
 */
export interface TranscriptCompleteEvent {
  meetingId: string;
  transcriptId: string;
  wordCount: number;
  speakerCount: number;
  durationMs: number;
  timestamp: string;
}

/**
 * Summary completed event
 */
export interface SummaryCompleteEvent {
  meetingId: string;
  summaryId: string;
  actionItemCount: number;
  timestamp: string;
}

/**
 * Meeting updated event
 */
export interface MeetingUpdatedEvent {
  meetingId: string;
  status: string;
  updatedFields: string[];
  timestamp: string;
}

/**
 * Error event
 */
export interface ErrorEvent {
  code: string;
  message: string;
  meetingId?: string;
  timestamp: string;
}

/**
 * Room name helpers
 */
export function getMeetingRoom(meetingId: string): string {
  return `meeting:${meetingId}`;
}

export function getOrganizationRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}
