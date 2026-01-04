'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, formatTime } from '@/lib/utils';
import type { Meeting } from '@/types';

interface UpcomingMeetingsProps {
  meetings?: Meeting[];
  isLoading?: boolean;
}

export function UpcomingMeetings({ meetings, isLoading }: UpcomingMeetingsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
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
          <CardTitle>Upcoming Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No upcoming meetings"
            description="Connect your calendar to see upcoming meetings"
            action={{
              label: 'Connect Calendar',
              onClick: () => {
                // Navigate to calendar settings
              },
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // Group meetings by date
  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 86400000).toDateString();

  const groupedMeetings = meetings.reduce(
    (acc, meeting) => {
      const date = meeting.startTime
        ? new Date(meeting.startTime).toDateString()
        : 'unknown';

      if (date === today) {
        acc.today.push(meeting);
      } else if (date === tomorrow) {
        acc.tomorrow.push(meeting);
      } else {
        acc.later.push(meeting);
      }

      return acc;
    },
    { today: [] as Meeting[], tomorrow: [] as Meeting[], later: [] as Meeting[] }
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Meetings</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/calendar">
            View calendar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groupedMeetings.today.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-slate-500">Today</h4>
              <div className="space-y-2">
                {groupedMeetings.today.map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} isToday />
                ))}
              </div>
            </div>
          )}

          {groupedMeetings.tomorrow.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-slate-500">Tomorrow</h4>
              <div className="space-y-2">
                {groupedMeetings.tomorrow.map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          )}

          {groupedMeetings.later.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-slate-500">Later</h4>
              <div className="space-y-2">
                {groupedMeetings.later.slice(0, 3).map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} showDate />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingItem({
  meeting,
  isToday,
  showDate,
}: {
  meeting: Meeting;
  isToday?: boolean;
  showDate?: boolean;
}) {
  const time = meeting.startTime ? formatTime(meeting.startTime) : 'TBD';
  const date = meeting.startTime ? formatDate(meeting.startTime) : '';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Clock className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h5 className="font-medium text-slate-900">{meeting.title}</h5>
        <p className="text-sm text-slate-500">
          {showDate ? `${date} at ` : ''}
          {time}
        </p>
      </div>
      {isToday && (
        <Badge variant="default" className="bg-primary-500">
          Today
        </Badge>
      )}
    </div>
  );
}
