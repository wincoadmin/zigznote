'use client';

import Link from 'next/link';
import { Video, MoreVertical, Trash2, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import { meetingStatusConfig, platformConfig, type MeetingStatus } from '@/lib/design-tokens';
import type { Meeting, MeetingParticipant } from '@/types';

interface MeetingCardProps {
  meeting: Meeting;
  participants?: MeetingParticipant[];
  onDelete?: (id: string) => void;
}

export function MeetingCard({ meeting, participants = [], onDelete }: MeetingCardProps) {
  const status = meetingStatusConfig[meeting.status as MeetingStatus] || meetingStatusConfig.scheduled;
  const platform = meeting.platform
    ? platformConfig[meeting.platform as keyof typeof platformConfig]
    : null;

  return (
    <Card className="group relative overflow-hidden">
      {/* Status indicator line */}
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: status.color }}
      />

      <div className="flex items-start gap-4 p-5 pl-6">
        {/* Platform icon */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: platform ? `${platform.color}15` : '#f1f5f9',
            color: platform?.color || '#64748b',
          }}
        >
          <Video className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link
                href={`/meetings/${meeting.id}`}
                className="font-medium text-slate-900 hover:text-primary-600 line-clamp-1"
              >
                {meeting.title}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                {meeting.startTime ? (
                  <>
                    {formatDate(meeting.startTime)} at {formatTime(meeting.startTime)}
                  </>
                ) : (
                  'No date scheduled'
                )}
                {meeting.durationSeconds && (
                  <span className="ml-2">• {formatDuration(meeting.durationSeconds)}</span>
                )}
              </p>
            </div>

            <Badge className={`${status.bgColor} ${status.textColor} shrink-0`}>
              {status.label}
            </Badge>
          </div>

          {/* Participants */}
          {participants.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <AvatarGroup max={3}>
                {participants.map((p) => (
                  <Avatar key={p.id} name={p.name} size="sm" />
                ))}
              </AvatarGroup>
              <span className="text-sm text-slate-500">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Quick actions (show on hover) */}
          <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/meetings/${meeting.id}`}>
                View Details
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(meeting.id)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
