'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  MeetingPlayer,
  TranscriptViewer,
  SummaryPanel,
  ActionItems,
  MeetingChat,
} from '@/components/meetings';
import { ShareDialog, ExportMenu } from '@/components/settings';
import { meetingsApi } from '@/lib/api';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import { meetingStatusConfig, type MeetingStatus } from '@/lib/design-tokens';
import type { Meeting, Transcript, Summary, ActionItem } from '@/types';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const meetingId = params.id as string;

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Fetch meeting details
  const { data: meeting, isLoading: meetingLoading } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: async () => {
      const response = await meetingsApi.getById(meetingId);
      if (response.success && response.data) {
        return response.data as Meeting;
      }
      throw new Error('Meeting not found');
    },
  });

  // Fetch transcript
  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['transcript', meetingId],
    queryFn: async () => {
      const response = await meetingsApi.getTranscript(meetingId);
      if (response.success && response.data) {
        return response.data as Transcript;
      }
      return null;
    },
    enabled: !!meeting,
  });

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', meetingId],
    queryFn: async () => {
      const response = await meetingsApi.getSummary(meetingId);
      if (response.success && response.data) {
        return response.data as Summary;
      }
      return null;
    },
    enabled: !!meeting,
  });

  // Fetch action items
  const { data: actionItems, isLoading: actionItemsLoading } = useQuery({
    queryKey: ['actionItems', meetingId],
    queryFn: async () => {
      const response = await meetingsApi.getActionItems(meetingId);
      if (response.success && response.data) {
        return response.data as ActionItem[];
      }
      return [];
    },
    enabled: !!meeting,
  });

  // Regenerate summary mutation
  const regenerateMutation = useMutation({
    mutationFn: () => meetingsApi.regenerateSummary(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', meetingId] });
      addToast({
        type: 'success',
        title: 'Regenerating summary',
        description: 'A new summary is being generated.',
      });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to regenerate summary.',
      });
    },
  });

  // Toggle action item mutation
  const toggleActionItemMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      meetingsApi.updateActionItem(meetingId, id, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionItems', meetingId] });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to update action item.',
      });
    },
  });

  // Delete action item mutation
  const deleteActionItemMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.deleteActionItem(meetingId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionItems', meetingId] });
      addToast({
        type: 'success',
        title: 'Deleted',
        description: 'Action item removed.',
      });
    },
  });

  const handleTimeUpdate = (time: number) => {
    setCurrentTimeMs(time * 1000);
  };

  const handleSegmentClick = (startMs: number) => {
    setCurrentTimeMs(startMs);
  };

  if (meetingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-xl font-semibold text-slate-900">Meeting not found</h2>
        <p className="mt-2 text-slate-500">
          The meeting you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button asChild className="mt-4">
          <Link href="/meetings">Back to meetings</Link>
        </Button>
      </div>
    );
  }

  const status = meetingStatusConfig[meeting.status as MeetingStatus] || meetingStatusConfig.scheduled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/meetings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-slate-900">
                {meeting.title}
              </h1>
              <Badge className={`${status.bgColor} ${status.textColor}`}>
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-slate-500">
              {meeting.startTime ? (
                <>
                  {formatDate(meeting.startTime)} at {formatTime(meeting.startTime)}
                </>
              ) : (
                'No date'
              )}
              {meeting.durationSeconds && (
                <> • {formatDuration(meeting.durationSeconds)}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsShareOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <ExportMenu
            meetingId={meetingId}
            meetingTitle={meeting.title}
            hasTranscript={!!transcript}
            hasSummary={!!summary}
            hasActionItems={!!actionItems && actionItems.length > 0}
          />
        </div>
      </div>

      {/* Main content - 3-panel layout on large screens */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Player + Transcript */}
        <div className="lg:col-span-2 space-y-4">
          {/* Player */}
          <MeetingPlayer
            audioUrl={meeting.recordingUrl}
            duration={meeting.durationSeconds}
            currentTime={currentTimeMs / 1000}
            onTimeUpdate={handleTimeUpdate}
          />

          {/* Transcript */}
          <TranscriptViewer
            segments={transcript?.segments}
            currentTimeMs={currentTimeMs}
            onSegmentClick={handleSegmentClick}
            isLoading={transcriptLoading}
            className="h-[500px]"
          />
        </div>

        {/* Right column - Summary + Action Items */}
        <div className="space-y-4">
          <SummaryPanel
            summary={summary}
            isLoading={summaryLoading}
            onRegenerate={() => regenerateMutation.mutate()}
            isRegenerating={regenerateMutation.isPending}
          />

          <ActionItems
            actionItems={actionItems}
            isLoading={actionItemsLoading}
            onToggle={(id, completed) =>
              toggleActionItemMutation.mutate({ id, completed })
            }
            onDelete={(id) => deleteActionItemMutation.mutate(id)}
          />
        </div>
      </div>

      {/* AI Meeting Assistant Chat */}
      {meeting.status === 'completed' && transcript && (
        <MeetingChat meetingId={meetingId} meetingTitle={meeting.title} />
      )}

      {/* Share Dialog */}
      <ShareDialog
        meetingId={meetingId}
        meetingTitle={meeting.title}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
