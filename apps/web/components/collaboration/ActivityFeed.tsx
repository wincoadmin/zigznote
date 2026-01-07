'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  MessageSquare,
  Tag,
  Share2,
  Eye,
  Edit3,
  UserPlus,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { activityApi, type Activity as ActivityType, type ActivityAction } from '@/lib/api';
import Link from 'next/link';

interface ActivityFeedProps {
  meetingId?: string;
  limit?: number;
  className?: string;
}

const ACTION_ICONS: Record<ActivityAction, React.ReactNode> = {
  MEETING_CREATED: <Edit3 className="w-4 h-4 text-emerald-500" />,
  MEETING_UPDATED: <Edit3 className="w-4 h-4 text-blue-500" />,
  MEETING_SHARED: <Share2 className="w-4 h-4 text-purple-500" />,
  MEETING_VIEWED: <Eye className="w-4 h-4 text-slate-500" />,
  COMMENT_ADDED: <MessageSquare className="w-4 h-4 text-cyan-500" />,
  COMMENT_REPLIED: <MessageSquare className="w-4 h-4 text-amber-500" />,
  COMMENT_RESOLVED: <CheckCircle className="w-4 h-4 text-green-500" />,
  ANNOTATION_ADDED: <Tag className="w-4 h-4 text-pink-500" />,
  ANNOTATION_UPDATED: <Tag className="w-4 h-4 text-indigo-500" />,
  MEMBER_JOINED: <UserPlus className="w-4 h-4 text-teal-500" />,
  PERMISSION_CHANGED: <Share2 className="w-4 h-4 text-orange-500" />,
};

function UserAvatar({
  name,
  avatarUrl,
  size = 'sm',
}: {
  name: string | null;
  avatarUrl: string | null;
  size?: 'sm' | 'md';
}) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        className={cn('rounded-full object-cover', sizeClasses)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center font-medium text-emerald-700 dark:text-emerald-300',
        sizeClasses
      )}
    >
      {initials}
    </div>
  );
}

function ActivityItem({ activity }: { activity: ActivityType }) {
  const userName =
    activity.user.name ||
    `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim() ||
    activity.user.email;

  return (
    <div className="flex items-start gap-3 py-3">
      <UserAvatar name={userName} avatarUrl={activity.user.avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {ACTION_ICONS[activity.action]}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {activity.formattedMessage || (
              <>
                <span className="font-medium">{userName}</span> performed an action
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </span>
          {activity.meeting && (
            <>
              <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
              <Link
                href={`/meetings/${activity.meeting.id}`}
                className="text-xs text-emerald-600 hover:underline truncate max-w-[200px]"
              >
                {activity.meeting.title}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ meetingId, limit = 20, className }: ActivityFeedProps) {
  // Fetch activity
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['activity', meetingId, limit],
    queryFn: async () => {
      const response = meetingId
        ? await activityApi.getMeetingActivity(meetingId, { limit })
        : await activityApi.getFeed({ limit });
      return response.success ? response.data || [] : [];
    },
  });

  const activities = activityData || [];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <Activity className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Activity</h3>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto px-4 divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Activity will appear here as team members interact</p>
          </div>
        ) : (
          activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
