'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { TranscriptSegment, MeetingStatus } from '@/types';

// Event types from the server
export interface BotStatusEvent {
  meetingId: string;
  status: MeetingStatus;
  botId?: string;
  message?: string;
}

export interface TranscriptChunkEvent {
  meetingId: string;
  segment: TranscriptSegment;
  isFinal: boolean;
}

export interface SummaryCompleteEvent {
  meetingId: string;
  summaryId: string;
}

export interface ActionItemsEvent {
  meetingId: string;
  actionItems: { id: string; text: string; assignee?: string; dueDate?: string }[];
}

export interface ErrorEvent {
  meetingId: string;
  code: string;
  message: string;
}

// Socket connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
  meetingId?: string;
  autoConnect?: boolean;
  onBotStatus?: (event: BotStatusEvent) => void;
  onTranscriptChunk?: (event: TranscriptChunkEvent) => void;
  onSummaryComplete?: (event: SummaryCompleteEvent) => void;
  onActionItems?: (event: ActionItemsEvent) => void;
  onError?: (event: ErrorEvent) => void;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (meetingId: string) => void;
  leaveRoom: (meetingId: string) => void;
  isConnected: boolean;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    meetingId,
    autoConnect = true,
    onBotStatus,
    onTranscriptChunk,
    onSummaryComplete,
    onActionItems,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onBotStatus,
    onTranscriptChunk,
    onSummaryComplete,
    onActionItems,
    onError,
  });

  // Update callback refs when they change
  useEffect(() => {
    callbacksRef.current = {
      onBotStatus,
      onTranscriptChunk,
      onSummaryComplete,
      onActionItems,
      onError,
    };
  }, [onBotStatus, onTranscriptChunk, onSummaryComplete, onActionItems, onError]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setConnectionState('connecting');

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;

      // Auto-join room if meetingId is provided
      if (meetingId) {
        socket.emit('join:meeting', { meetingId });
      }
    });

    socket.on('disconnect', (reason) => {
      setConnectionState('disconnected');

      // If the server disconnected us, we should try to reconnect
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      reconnectAttemptsRef.current++;

      if (reconnectAttemptsRef.current >= RECONNECT_ATTEMPTS) {
        setConnectionState('error');
      }
    });

    // Bot status events
    socket.on('bot:status', (event: BotStatusEvent) => {
      callbacksRef.current.onBotStatus?.(event);
    });

    // Transcript events
    socket.on('transcript:chunk', (event: TranscriptChunkEvent) => {
      callbacksRef.current.onTranscriptChunk?.(event);
    });

    // Summary complete events
    socket.on('summary:complete', (event: SummaryCompleteEvent) => {
      callbacksRef.current.onSummaryComplete?.(event);
    });

    // Action items events
    socket.on('actionItems:update', (event: ActionItemsEvent) => {
      callbacksRef.current.onActionItems?.(event);
    });

    // Error events
    socket.on('error', (event: ErrorEvent) => {
      callbacksRef.current.onError?.(event);
    });

    socketRef.current = socket;
  }, [meetingId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionState('disconnected');
    }
  }, []);

  const joinRoom = useCallback((roomMeetingId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:meeting', { meetingId: roomMeetingId });
    }
  }, []);

  const leaveRoom = useCallback((roomMeetingId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:meeting', { meetingId: roomMeetingId });
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Handle meetingId changes
  useEffect(() => {
    if (socketRef.current?.connected && meetingId) {
      joinRoom(meetingId);
    }
  }, [meetingId, joinRoom]);

  return {
    connectionState,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    isConnected: connectionState === 'connected',
  };
}
