'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import { meetingStatusConfig, platformConfig, type MeetingStatus } from '@/lib/design-tokens';
import type { Meeting } from '@/types';

interface RecentMeetingsProps {
  meetings?: Meeting[];
  isLoading?: boolean;
}

export function RecentMeetings({ meetings, isLoading }: RecentMeetingsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-4 p-3 sm:p-6 pt-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="border-0 p-0 shadow-none" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!meetings || meetings.length === 0) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <EmptyState
            title="No recent meetings"
            description="Your completed meetings will appear here"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Recent Meetings</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm">
          <Link href="/meetings">
            View all
            <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="space-y-2 sm:space-y-4">
          {meetings.slice(0, 5).map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const status = meetingStatusConfig[meeting.status as MeetingStatus] || meetingStatusConfig.scheduled;
  const platform = meeting.platform
    ? platformConfig[meeting.platform as keyof typeof platformConfig]
    : null;

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="flex items-center justify-between rounded-lg border border-slate-100 p-2 sm:p-4 transition-all hover:border-slate-200 hover:bg-slate-50 gap-2"
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
          {platform ? (
            <span className="text-[10px] sm:text-xs font-medium">{platform.name.slice(0, 2)}</span>
          ) : (
            <span className="text-[10px] sm:text-xs font-medium">MT</span>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-medium text-sm sm:text-base text-slate-900 truncate">{meeting.title}</h4>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            {meeting.startTime ? formatDate(meeting.startTime) : 'No date'}
            {meeting.startTime && ` at ${formatTime(meeting.startTime)}`}
            {meeting.durationSeconds && ` • ${formatDuration(meeting.durationSeconds)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Badge variant={meeting.status === 'completed' ? 'success' : 'secondary'} className="text-xs">
          {status.label}
        </Badge>
      </div>
    </Link>
  );
}
