'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import {
  useWebSocket,
  BotStatusEvent,
  TranscriptChunkEvent,
  SummaryCompleteEvent,
  ActionItemsEvent,
} from './useWebSocket';
import type { Meeting, Transcript, TranscriptSegment } from '@/types';

interface UseMeetingUpdatesOptions {
  meetingId: string;
  enabled?: boolean;
}

/**
 * Hook that subscribes to real-time meeting updates and syncs with React Query cache
 */
export function useMeetingUpdates({ meetingId, enabled = true }: UseMeetingUpdatesOptions) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const handleBotStatus = (event: BotStatusEvent) => {
    if (event.meetingId !== meetingId) return;

    // Update meeting status in cache
    queryClient.setQueryData<Meeting>(['meeting', meetingId], (old) => {
      if (!old) return old;
      return { ...old, status: event.status };
    });

    // Also update in meetings list
    queryClient.invalidateQueries({ queryKey: ['meetings'] });

    // Show toast for important status changes
    switch (event.status) {
      case 'recording':
        addToast({
          type: 'info',
          title: 'Recording started',
          description: 'The meeting bot is now recording.',
        });
        break;
      case 'processing':
        addToast({
          type: 'info',
          title: 'Processing',
          description: 'Transcription is being processed.',
        });
        break;
      case 'completed':
        addToast({
          type: 'success',
          title: 'Meeting completed',
          description: 'Transcription and summary are ready.',
        });
        break;
      case 'failed':
        addToast({
          type: 'error',
          title: 'Processing failed',
          description: event.message || 'Something went wrong.',
        });
        break;
    }
  };

  const handleTranscriptChunk = (event: TranscriptChunkEvent) => {
    if (event.meetingId !== meetingId) return;

    // Update transcript in cache
    queryClient.setQueryData<Transcript>(['transcript', meetingId], (old) => {
      if (!old) {
        // Create new transcript if none exists
        return {
          id: `temp-${Date.now()}`,
          meetingId,
          segments: [event.segment],
          fullText: event.segment.text,
          wordCount: event.segment.text.split(/\s+/).length,
          language: 'en',
          createdAt: new Date().toISOString(),
        };
      }

      // Check if segment already exists (by startMs)
      const existingIndex = old.segments.findIndex(
        (s) => s.startMs === event.segment.startMs
      );

      let newSegments: TranscriptSegment[];
      if (existingIndex >= 0) {
        // Update existing segment
        newSegments = [...old.segments];
        newSegments[existingIndex] = event.segment;
      } else {
        // Add new segment and sort by startMs
        newSegments = [...old.segments, event.segment].sort(
          (a, b) => a.startMs - b.startMs
        );
      }

      // Update full text and word count
      const fullText = newSegments.map((s) => s.text).join(' ');

      return {
        ...old,
        segments: newSegments,
        fullText,
        wordCount: fullText.split(/\s+/).length,
      };
    });
  };

  const handleSummaryComplete = (event: SummaryCompleteEvent) => {
    if (event.meetingId !== meetingId) return;

    // Invalidate summary query to refetch
    queryClient.invalidateQueries({ queryKey: ['summary', meetingId] });

    addToast({
      type: 'success',
      title: 'Summary ready',
      description: 'The AI summary has been generated.',
    });
  };

  const handleActionItems = (event: ActionItemsEvent) => {
    if (event.meetingId !== meetingId) return;

    // Invalidate action items query to refetch
    queryClient.invalidateQueries({ queryKey: ['actionItems', meetingId] });
  };

  const handleError = (event: { meetingId: string; code: string; message: string }) => {
    if (event.meetingId !== meetingId) return;

    addToast({
      type: 'error',
      title: 'Real-time error',
      description: event.message,
    });
  };

  const { connectionState, isConnected } = useWebSocket({
    meetingId: enabled ? meetingId : undefined,
    autoConnect: enabled,
    onBotStatus: handleBotStatus,
    onTranscriptChunk: handleTranscriptChunk,
    onSummaryComplete: handleSummaryComplete,
    onActionItems: handleActionItems,
    onError: handleError,
  });

  return {
    connectionState,
    isConnected,
  };
}
