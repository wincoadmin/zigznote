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
        <CardHeader>
          <CardTitle>Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        <CardHeader>
          <CardTitle>Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Meetings</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meetings">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
      className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-all hover:border-slate-200 hover:bg-slate-50"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          {platform ? (
            <span className="text-xs font-medium">{platform.name.slice(0, 2)}</span>
          ) : (
            <span className="text-xs font-medium">MT</span>
          )}
        </div>
        <div>
          <h4 className="font-medium text-slate-900">{meeting.title}</h4>
          <p className="text-sm text-slate-500">
            {meeting.startTime ? formatDate(meeting.startTime) : 'No date'}
            {meeting.startTime && ` at ${formatTime(meeting.startTime)}`}
            {meeting.durationSeconds && ` • ${formatDuration(meeting.durationSeconds)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={meeting.status === 'completed' ? 'success' : 'secondary'}>
          {status.label}
        </Badge>
      </div>
    </Link>
  );
}
