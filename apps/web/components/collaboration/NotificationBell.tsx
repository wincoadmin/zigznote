'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  Share2,
  AtSign,
  Reply,
  Tag,
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { notificationsApi, type Notification, type NotificationType } from '@/lib/api';
import Link from 'next/link';

interface NotificationBellProps {
  className?: string;
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  MEETING_READY: <Calendar className="w-4 h-4 text-emerald-500" />,
  MEETING_SHARED: <Share2 className="w-4 h-4 text-blue-500" />,
  MENTION: <AtSign className="w-4 h-4 text-purple-500" />,
  REPLY: <Reply className="w-4 h-4 text-amber-500" />,
  COMMENT_ADDED: <MessageSquare className="w-4 h-4 text-cyan-500" />,
  ANNOTATION_ADDED: <Tag className="w-4 h-4 text-pink-500" />,
  ACTION_ITEM_DUE: <AlertCircle className="w-4 h-4 text-red-500" />,
  PERMISSION_CHANGED: <Share2 className="w-4 h-4 text-indigo-500" />,
  SYSTEM: <Bell className="w-4 h-4 text-slate-500" />,
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
        !notification.read && 'bg-emerald-50/50 dark:bg-emerald-900/10'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {NOTIFICATION_ICONS[notification.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {notification.title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
            {notification.meeting && (
              <Link
                href={`/meetings/${notification.meeting.id}`}
                className="text-xs text-emerald-600 hover:underline mt-1 inline-block"
              >
                {notification.meeting.title}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead();
                }}
                title="Mark as read"
                className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsApi.getNotifications({ limit: 20 });
      return response.success ? response.data || [] : [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const response = await notificationsApi.getUnreadCount();
      return response.success && response.data ? response.data.count : 0;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const notifications = notificationsData || [];
  const unreadCount = unreadData || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-medium text-white bg-red-500 rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {markAllAsReadMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3" />
                  )}
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
                <p className="text-xs mt-1">You&apos;re all caught up!</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsReadMutation.mutate(notification.id)}
                  onDelete={() => deleteMutation.mutate(notification.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <Link
                href="/settings/notifications"
                className="text-xs text-emerald-600 hover:underline"
                onClick={() => setIsOpen(false)}
              >
                Notification settings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
