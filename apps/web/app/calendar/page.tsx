'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  RefreshCw,
  Calendar as CalendarIcon,
  Settings,
  Loader2,
  ExternalLink,
  Play,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { calendarApi, meetingsApi, type CalendarEvent } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  zoom: { bg: 'bg-blue-100', text: 'text-blue-700' },
  meet: { bg: 'bg-green-100', text: 'text-green-700' },
  google: { bg: 'bg-green-100', text: 'text-green-700' },
  teams: { bg: 'bg-purple-100', text: 'text-purple-700' },
  webex: { bg: 'bg-red-100', text: 'text-red-700' },
};

function detectPlatform(link: string | undefined): string {
  if (!link) return 'other';
  const lower = link.toLowerCase();
  if (lower.includes('zoom.us')) return 'zoom';
  if (lower.includes('meet.google.com')) return 'meet';
  if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'teams';
  if (lower.includes('webex.com')) return 'webex';
  return 'other';
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for the current month view
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  // Fetch calendar connection status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: async () => {
      const response = await calendarApi.getStatus();
      return response.success ? response.data : null;
    },
  });

  // Fetch calendar events
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async () => {
      const response = await calendarApi.getEvents(
        startOfMonth.toISOString(),
        endOfMonth.toISOString()
      );
      return response.success ? response.data?.events || [] : [];
    },
    enabled: !!statusData?.connection,
  });

  const connection = statusData?.connection;
  const events = eventsData || [];

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dateKey = new Date(event.start).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [events]);

  // Sync calendar mutation
  const syncMutation = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: () => {
      refetchEvents();
      addToast({
        type: 'success',
        title: 'Calendar synced',
        description: 'Your calendar has been synced.',
      });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Sync failed',
        description: 'Failed to sync calendar. Please try again.',
      });
    },
  });

  // Auto-record toggle mutation
  const autoRecordMutation = useMutation({
    mutationFn: (enabled: boolean) => calendarApi.setAutoRecord(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
      addToast({
        type: 'success',
        title: connection?.autoRecord ? 'Auto-record disabled' : 'Auto-record enabled',
        description: connection?.autoRecord
          ? 'Meetings will no longer be recorded automatically.'
          : 'All your meetings will be recorded automatically.',
      });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to update auto-record setting.',
      });
    },
  });

  // Send bot mutation
  const sendBotMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      // Create meeting first
      const createResponse = await meetingsApi.create({
        title: event.title,
        meetingUrl: event.meetingLink,
        platform: detectPlatform(event.meetingLink),
      });

      if (!createResponse.success || !createResponse.data) {
        throw new Error('Failed to create meeting');
      }

      const meetingData = createResponse.data as { id: string };

      // Deploy bot
      const botResponse = await fetch(`/api/meetings/${meetingData.id}/bot`, {
        method: 'POST',
      });

      if (!botResponse.ok) {
        throw new Error('Failed to send bot');
      }

      return meetingData.id;
    },
    onSuccess: () => {
      refetchEvents();
      addToast({
        type: 'success',
        title: 'Bot sent',
        description: 'The bot will join the meeting.',
      });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to send bot to meeting.',
      });
    },
  });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const getEventsForDay = (day: number) => {
    const dateKey = new Date(year, month, day).toDateString();
    return eventsByDate[dateKey] || [];
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : [];

  // Not connected - show connect UI
  if (!statusLoading && !connection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendar</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Connect your calendar to automatically record meetings
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
          <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Connect Your Calendar
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Link your Google Calendar to see your meetings and automatically send a bot to record
            them.
          </p>
          <Button asChild size="lg">
            <Link href="/settings/integrations">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Connect Google Calendar
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 dark:bg-slate-950" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDay(day);
      const hasEvents = dayEvents.length > 0;

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(new Date(year, month, day))}
          className={`h-24 p-2 border-t border-slate-200 dark:border-slate-700 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
            isSelected(day) ? 'bg-emerald-50 dark:bg-emerald-950 ring-2 ring-emerald-500 ring-inset' : ''
          } ${isToday(day) ? 'bg-emerald-50 dark:bg-emerald-950' : ''}`}
        >
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
              isToday(day)
                ? 'bg-emerald-500 text-white font-semibold'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {day}
          </span>
          {hasEvents && (
            <div className="mt-1 space-y-0.5">
              {dayEvents.slice(0, 2).map((event) => (
                <div
                  key={event.id}
                  className="text-xs text-emerald-600 dark:text-emerald-400 truncate"
                >
                  {new Date(event.start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  {event.title.length > 10 ? event.title.substring(0, 10) + '...' : event.title}
                </div>
              ))}
              {dayEvents.length > 2 && (
                <div className="text-xs text-slate-500">+{dayEvents.length - 2} more</div>
              )}
            </div>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendar</h1>
          <p className="text-slate-500 dark:text-slate-400">
            View and manage your meeting schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-record toggle */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Auto-record</span>
            <Switch
              checked={connection?.autoRecord ?? false}
              onChange={(e) => autoRecordMutation.mutate(e.target.checked)}
              disabled={autoRecordMutation.isPending}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integrations">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>

          <Button asChild>
            <Link href="/meetings/new">
              <Plus className="w-4 h-4 mr-2" />
              New Meeting
            </Link>
          </Button>
        </div>
      </div>

      {/* Connection info */}
      {connection && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Check className="w-4 h-4 text-emerald-500" />
          Connected to {connection.email || connection.provider}
          {connection.lastSyncedAt && (
            <span>
              · Last synced {new Date(connection.lastSyncedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {eventsLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="grid grid-cols-7">{renderCalendarDays()}</div>
          )}
        </div>

        {/* Selected Day Details */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h3>

          {selectedDate && selectedDayEvents.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No meetings scheduled for this day.
            </p>
          )}

          {selectedDate && selectedDayEvents.length > 0 && (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => {
                const platform = detectPlatform(event.meetingLink);
                const colors = PLATFORM_COLORS[platform] || { bg: 'bg-slate-100', text: 'text-slate-700' };
                const hasLink = !!event.meetingLink;

                return (
                  <div
                    key={event.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Video className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {event.title}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {new Date(event.start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(event.end).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                        {event.location && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-1">
                            {event.location}
                          </p>
                        )}
                      </div>
                    </div>

                    {hasLink && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => sendBotMutation.mutate(event)}
                          disabled={sendBotMutation.isPending}
                        >
                          {sendBotMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Play className="w-3 h-3 mr-1" />
                          )}
                          Record
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a href={event.meetingLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Join
                          </a>
                        </Button>
                      </div>
                    )}

                    {event.meetingId && (
                      <div className="mt-2">
                        <Link
                          href={`/meetings/${event.meetingId}`}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          View recording →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
