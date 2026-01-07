'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Share2,
  FileText,
  MessageSquare,
  Tag,
  Activity,
  Video,
  Send,
  Loader2,
} from 'lucide-react';
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
  BotStatus,
} from '@/components/meetings';
import { ShareDialog, ExportMenu } from '@/components/settings';
import {
  CommentsPanel,
  AnnotationBar,
  ActivityFeed,
} from '@/components/collaboration';
import { meetingsApi } from '@/lib/api';
import { formatDate, formatTime, formatDuration, cn } from '@/lib/utils';
import { meetingStatusConfig, type MeetingStatus } from '@/lib/design-tokens';
import type { Meeting, Transcript, Summary, ActionItem } from '@/types';

type SidebarTab = 'summary' | 'comments' | 'annotations' | 'activity';

const SIDEBAR_TABS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
  { id: 'comments', label: 'Comments', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'annotations', label: 'Annotations', icon: <Tag className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
];

export default function MeetingDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const meetingId = params.id as string;

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('summary');
  const [isSendingBot, setIsSendingBot] = useState(false);

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

  const handleSendBot = async () => {
    if (!meeting?.meetingUrl) return;

    setIsSendingBot(true);
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/bot`, {
        method: 'POST',
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['meeting', meeting.id] });
        addToast({
          type: 'success',
          title: 'Bot sent',
          description: 'The bot is joining the meeting.',
        });
      } else {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to send bot');
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to send bot',
      });
    } finally {
      setIsSendingBot(false);
    }
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
              <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100">
                {meeting.title}
              </h1>
              <Badge className={`${status.bgColor} ${status.textColor}`}>
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {meeting.startTime ? (
                <>
                  {formatDate(meeting.startTime)} at {formatTime(meeting.startTime)}
                </>
              ) : (
                'No date'
              )}
              {meeting.durationSeconds && (
                <> &bull; {formatDuration(meeting.durationSeconds)}</>
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

      {/* Bot Status & Controls */}
      {meeting.meetingUrl && (
        <div className="mb-2">
          {meeting.botId ? (
            <BotStatus meetingId={meeting.id} />
          ) : meeting.status === 'scheduled' ? (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Ready to record</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">Send a bot to record this meeting</p>
              </div>
              <Button onClick={handleSendBot} disabled={isSendingBot}>
                {isSendingBot ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Bot
              </Button>
            </div>
          ) : null}
        </div>
      )}

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

        {/* Right column - Tabbed sidebar */}
        <div className="space-y-4">
          {/* Tab navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {SIDEBAR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {activeTab === 'summary' && (
              <div className="space-y-4 p-4">
                <SummaryPanel
                  summary={summary}
                  isLoading={summaryLoading}
                  onRegenerate={() => regenerateMutation.mutate()}
                  isRegenerating={regenerateMutation.isPending}
                  className="border-0 shadow-none p-0"
                />

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <ActionItems
                    actionItems={actionItems}
                    isLoading={actionItemsLoading}
                    onToggle={(id, completed) =>
                      toggleActionItemMutation.mutate({ id, completed })
                    }
                    onDelete={(id) => deleteActionItemMutation.mutate(id)}
                    className="border-0 shadow-none p-0"
                  />
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <CommentsPanel meetingId={meetingId} className="h-[600px]" />
            )}

            {activeTab === 'annotations' && (
              <AnnotationBar meetingId={meetingId} className="h-[600px]" />
            )}

            {activeTab === 'activity' && (
              <ActivityFeed meetingId={meetingId} limit={50} className="h-[600px]" />
            )}
          </div>
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
