# Phase 13: Meeting Bot UI

## Overview

Connect the existing Recall.ai backend to the frontend. Enable users to paste meeting links, deploy bots from the UI, view real calendar data, and auto-record scheduled meetings.

**Backend is complete** - this phase is purely frontend + minor API enhancements.

---

## Current State

### What Works (Backend)
| Feature | Endpoint | Status |
|---------|----------|--------|
| Create meeting with URL | `POST /api/v1/meetings` | ✅ |
| Deploy bot to meeting | `POST /api/v1/meetings/:id/bot` | ✅ |
| Get bot status | `GET /api/v1/meetings/:id/bot` | ✅ |
| Stop bot | `DELETE /api/v1/meetings/:id/bot` | ✅ |
| Recall webhooks | `POST /api/webhooks/recall` | ✅ |
| Google Calendar OAuth | `GET /api/calendar/google/connect` | ✅ |
| Calendar sync | `POST /api/calendar/sync` | ✅ |

### What's Missing (Frontend)
| Feature | Status |
|---------|--------|
| Paste meeting link UI | ❌ |
| Send bot button | ❌ |
| Real calendar data display | ❌ |
| Auto-record toggle | ❌ |
| Bot status indicator | ❌ |

---

## 13.1 New Meeting Page - Add "Join Meeting" Tab

Update `apps/web/app/(dashboard)/meetings/new/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AudioUploader, BrowserRecorder } from '@/components/audio';
import { MeetingLinkInput } from '@/components/meetings/MeetingLinkInput';

export default function NewMeetingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('link'); // Default to link now

  const handleComplete = (meetingId: string) => {
    router.push(`/meetings/${meetingId}`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Meeting</h1>
        <p className="text-slate-500 mt-1">
          Record a live meeting, upload a recording, or record in-person
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-3">
          <TabsTrigger value="link">Join Meeting</TabsTrigger>
          <TabsTrigger value="upload">Upload Audio</TabsTrigger>
          <TabsTrigger value="record">Record Live</TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <MeetingLinkInput onMeetingCreated={handleComplete} />
        </TabsContent>

        <TabsContent value="upload">
          <AudioUploader onUploadComplete={handleComplete} />
        </TabsContent>

        <TabsContent value="record">
          <BrowserRecorder onRecordingComplete={handleComplete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 13.2 Meeting Link Input Component

Create `apps/web/components/meetings/MeetingLinkInput.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Calendar, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { meetingsApi } from '@/lib/api';

interface MeetingLinkInputProps {
  onMeetingCreated: (meetingId: string) => void;
}

type Platform = 'zoom' | 'meet' | 'teams' | 'webex' | 'other';

interface ParsedUrl {
  platform: Platform;
  isValid: boolean;
}

const PLATFORM_INFO: Record<Platform, { name: string; color: string; icon: string }> = {
  zoom: { name: 'Zoom', color: 'bg-blue-500', icon: '📹' },
  meet: { name: 'Google Meet', color: 'bg-green-500', icon: '🟢' },
  teams: { name: 'Microsoft Teams', color: 'bg-purple-500', icon: '🟣' },
  webex: { name: 'Webex', color: 'bg-red-500', icon: '🔴' },
  other: { name: 'Other', color: 'bg-gray-500', icon: '🔗' },
};

function parseUrl(url: string): ParsedUrl {
  if (!url) return { platform: 'other', isValid: false };
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('zoom.us') || lowerUrl.startsWith('zoommtg://')) {
    return { platform: 'zoom', isValid: true };
  }
  if (lowerUrl.includes('meet.google.com')) {
    return { platform: 'meet', isValid: true };
  }
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) {
    return { platform: 'teams', isValid: true };
  }
  if (lowerUrl.includes('webex.com')) {
    return { platform: 'webex', isValid: true };
  }
  
  // Check if it's a valid URL at all
  try {
    new URL(url);
    return { platform: 'other', isValid: true };
  } catch {
    return { platform: 'other', isValid: false };
  }
}

export function MeetingLinkInput({ onMeetingCreated }: MeetingLinkInputProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'confirm' | 'schedule' | 'joining'>('input');
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);
  
  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const parsed = parseUrl(url);
  const platformInfo = PLATFORM_INFO[parsed.platform];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parsed.isValid) {
      setError('Please enter a valid meeting URL');
      return;
    }

    setStep('confirm');
  };

  const handleSendBot = async (mode: 'now' | 'schedule' | 'later') => {
    // If schedule mode, show scheduler first
    if (mode === 'schedule' && step !== 'schedule') {
      setStep('schedule');
      // Set default to tomorrow at 9am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
      setScheduledTime('09:00');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('joining');

    try {
      // Calculate joinAt time if scheduling
      let joinAt: string | undefined;
      if (mode === 'schedule' && scheduledDate && scheduledTime) {
        joinAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // Step 1: Create the meeting
      const createResponse = await meetingsApi.create({
        title: title || `${platformInfo.name} Meeting`,
        meetingUrl: url,
        platform: parsed.platform,
        startTime: joinAt, // Store scheduled time
      });

      if (!createResponse.success || !createResponse.data) {
        throw new Error(createResponse.error?.message || 'Failed to create meeting');
      }

      const meetingId = createResponse.data.id;
      setCreatedMeetingId(meetingId);

      if (mode === 'now' || mode === 'schedule') {
        // Step 2: Deploy bot (immediately or scheduled)
        const botResponse = await fetch(`/api/meetings/${meetingId}/bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joinAt: joinAt, // Recall.ai will schedule the bot to join at this time
          }),
        });

        if (!botResponse.ok) {
          const data = await botResponse.json();
          throw new Error(data.error?.message || 'Failed to send bot');
        }
      }

      // Success - redirect to meeting page
      onMeetingCreated(meetingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Meeting Link
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Paste Zoom, Google Meet, or Teams link..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                className="pr-24"
              />
              {url && parsed.isValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${platformInfo.color}`}>
                    {platformInfo.name}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supports Zoom, Google Meet, Microsoft Teams, and Webex
            </p>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Meeting Title (optional)
            </label>
            <Input
              type="text"
              placeholder="e.g., Weekly Team Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={!url}>
            <Video className="w-4 h-4 mr-2" />
            Continue
          </Button>
        </form>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          {/* Meeting Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${platformInfo.color} text-white text-2xl`}>
                  {platformInfo.icon}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {title || `${platformInfo.name} Meeting`}
                  </h3>
                  <p className="text-sm text-slate-500 truncate max-w-xs">{url}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <div className="grid gap-3">
            <Button
              onClick={() => handleSendBot('now')}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Video className="w-4 h-4 mr-2" />
              )}
              Send Bot Now
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSendBot('schedule')}
              disabled={isLoading}
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Bot
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => handleSendBot('later')}
              disabled={isLoading}
              className="w-full"
            >
              <Clock className="w-4 h-4 mr-2" />
              Save for Later
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setStep('input')}
            className="w-full"
          >
            ← Back
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}

      {step === 'schedule' && (
        <div className="space-y-4">
          {/* Meeting Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${platformInfo.color} text-white text-2xl`}>
                  {platformInfo.icon}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {title || `${platformInfo.name} Meeting`}
                  </h3>
                  <p className="text-sm text-slate-500 truncate max-w-xs">{url}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <h4 className="font-medium text-slate-900">When should the bot join?</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            {scheduledDate && scheduledTime && (
              <p className="text-sm text-slate-600">
                Bot will join on{' '}
                <span className="font-medium">
                  {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            )}
          </div>

          <Button
            onClick={() => handleSendBot('schedule')}
            disabled={isLoading || !scheduledDate || !scheduledTime}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4 mr-2" />
            )}
            Schedule Bot
          </Button>

          <Button
            variant="ghost"
            onClick={() => setStep('confirm')}
            className="w-full"
          >
            ← Back
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}

      {step === 'joining' && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Sending bot to meeting...</h3>
          <p className="text-slate-500 mt-1">
            The bot will join and start recording automatically
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <h4 className="font-medium text-slate-900 mb-2">How it works</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Paste your meeting link above</li>
          <li>Our bot joins as "Zigznote Notetaker"</li>
          <li>The bot records and transcribes the meeting</li>
          <li>Get your summary and action items when it ends</li>
        </ol>
      </div>
    </div>
  );
}
```

---

## 13.3 Bot Status Component

Create `apps/web/components/meetings/BotStatus.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Video, Square, Loader2, CheckCircle, AlertCircle, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface BotStatusProps {
  meetingId: string;
  initialStatus?: BotStatusType;
  scheduledTime?: string; // ISO date string for scheduled join
  onStatusChange?: (status: BotStatusType) => void;
}

type BotStatusType = 'none' | 'scheduled' | 'ready' | 'joining' | 'waiting_room' | 'in_call' | 'recording' | 'leaving' | 'ended' | 'error';

const STATUS_CONFIG: Record<BotStatusType, {
  label: string;
  color: string;
  icon: React.ReactNode;
  showStop: boolean;
}> = {
  none: { label: 'No bot', color: 'text-slate-500', icon: null, showStop: false },
  scheduled: { label: 'Scheduled', color: 'text-blue-500', icon: <Calendar className="w-4 h-4" />, showStop: true },
  ready: { label: 'Ready to join', color: 'text-blue-500', icon: <Clock className="w-4 h-4" />, showStop: true },
  joining: { label: 'Joining...', color: 'text-yellow-500', icon: <Loader2 className="w-4 h-4 animate-spin" />, showStop: true },
  waiting_room: { label: 'In waiting room', color: 'text-yellow-500', icon: <Clock className="w-4 h-4" />, showStop: true },
  in_call: { label: 'In meeting', color: 'text-green-500', icon: <Video className="w-4 h-4" />, showStop: true },
  recording: { label: 'Recording', color: 'text-red-500', icon: <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />, showStop: true },
  leaving: { label: 'Leaving...', color: 'text-yellow-500', icon: <Loader2 className="w-4 h-4 animate-spin" />, showStop: false },
  ended: { label: 'Recording complete', color: 'text-green-500', icon: <CheckCircle className="w-4 h-4" />, showStop: false },
  error: { label: 'Error', color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, showStop: false },
};

export function BotStatus({ meetingId, initialStatus = 'none', scheduledTime, onStatusChange }: BotStatusProps) {
  const [status, setStatus] = useState<BotStatusType>(initialStatus);
  const [joinAt, setJoinAt] = useState<string | null>(scheduledTime || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for real-time updates
  const { lastMessage } = useWebSocket(`meeting:${meetingId}`);

  useEffect(() => {
    if (lastMessage?.event === 'bot:status') {
      const newStatus = lastMessage.data.status as BotStatusType;
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    }
  }, [lastMessage, onStatusChange]);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/bot`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.status) {
            setStatus(data.data.status);
          }
          if (data.data?.joinAt) {
            setJoinAt(data.data.joinAt);
          }
        }
      } catch (err) {
        console.error('Failed to fetch bot status:', err);
      }
    };

    fetchStatus();
  }, [meetingId]);

  const handleStopBot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/bot`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to stop bot');
      }

      setStatus('leaving');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    } finally {
      setIsLoading(false);
    }
  };

  const config = STATUS_CONFIG[status];

  if (status === 'none') {
    return null;
  }

  // Format scheduled time
  const formattedScheduledTime = joinAt
    ? new Date(joinAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <div className={`flex items-center gap-2 ${config.color}`}>
        {config.icon}
        <span className="text-sm font-medium">
          {status === 'scheduled' && formattedScheduledTime
            ? `Scheduled for ${formattedScheduledTime}`
            : config.label}
        </span>
      </div>

      {config.showStop && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStopBot}
          disabled={isLoading}
          className="ml-auto"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Square className="w-4 h-4 mr-1" />
              {status === 'scheduled' ? 'Cancel' : 'Stop'}
            </>
          )}
        </Button>
      )}

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
```

---

## 13.4 Update Meeting Detail Page

Update `apps/web/app/(dashboard)/meetings/[id]/page.tsx` to include bot controls:

```tsx
// Add to imports
import { BotStatus } from '@/components/meetings/BotStatus';
import { Button } from '@/components/ui/button';
import { Video, Send } from 'lucide-react';

// Add to the component, near the top of the content area:

{/* Bot Status & Controls */}
{meeting.meetingUrl && (
  <div className="mb-6">
    {meeting.botId ? (
      <BotStatus meetingId={meeting.id} />
    ) : meeting.status === 'scheduled' || meeting.status === 'pending' ? (
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <Video className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Ready to record</p>
          <p className="text-xs text-blue-700">Send a bot to record this meeting</p>
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

// Add handler function:
const [isSendingBot, setIsSendingBot] = useState(false);

const handleSendBot = async () => {
  setIsSendingBot(true);
  try {
    const response = await fetch(`/api/meetings/${meeting.id}/bot`, {
      method: 'POST',
    });
    if (response.ok) {
      // Refresh meeting data
      queryClient.invalidateQueries({ queryKey: ['meeting', meeting.id] });
    }
  } catch (err) {
    console.error('Failed to send bot:', err);
  } finally {
    setIsSendingBot(false);
  }
};
```

---

## 13.5 Real Calendar Page

Replace `apps/web/app/calendar/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Video, RefreshCw, Settings, Loader2, Send, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  meetingUrl?: string;
  platform?: string;
  meetingId?: string; // If already created in zigznote
  botStatus?: string;
}

interface CalendarConnection {
  id: string;
  provider: string;
  email: string;
  autoRecord: boolean;
  connectedAt: string;
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch calendar connection status
  const { data: connection, isLoading: connectionLoading } = useQuery({
    queryKey: ['calendar-connection'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/status');
      if (!res.ok) return null;
      const data = await res.json();
      return data.connection as CalendarConnection | null;
    },
  });

  // Fetch events for current month
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0).toISOString();
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.events as CalendarEvent[];
    },
    enabled: !!connection,
  });

  // Sync calendar
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      refetchEvents();
    },
  });

  // Toggle auto-record
  const autoRecordMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/calendar/auto-record', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connection'] });
    },
  });

  // Send bot to event
  const sendBotMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      // First create meeting if needed
      let meetingId = event.meetingId;
      
      if (!meetingId) {
        const createRes = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: event.title,
            meetingUrl: event.meetingUrl,
            platform: event.platform,
            startTime: event.start,
            endTime: event.end,
            calendarEventId: event.id,
          }),
        });
        if (!createRes.ok) throw new Error('Failed to create meeting');
        const data = await createRes.json();
        meetingId = data.data.id;
      }

      // Send bot
      const botRes = await fetch(`/api/meetings/${meetingId}/bot`, {
        method: 'POST',
      });
      if (!botRes.ok) throw new Error('Failed to send bot');
      
      return meetingId;
    },
    onSuccess: () => {
      refetchEvents();
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
    return day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  const getEventsForDay = (day: number) => {
    if (!events) return [];
    const dayStart = new Date(year, month, day);
    const dayEnd = new Date(year, month, day + 1);
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= dayStart && eventDate < dayEnd;
    });
  };

  const selectedDayEvents = getEventsForDay(selectedDate.getDate());

  // Not connected state
  if (!connectionLoading && !connection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
            <p className="text-slate-500">Connect your calendar to see upcoming meetings</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Connect Your Calendar</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Connect Google Calendar to automatically see your meetings and send recording bots.
            </p>
            <Button asChild>
              <Link href="/settings/integrations">
                <Plus className="w-4 h-4 mr-2" />
                Connect Calendar
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500">
            {connection?.email && `Synced with ${connection.email}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-record toggle */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
            <span className="text-sm text-slate-600">Auto-record all</span>
            <Switch
              checked={connection?.autoRecord || false}
              onCheckedChange={(checked) => autoRecordMutation.mutate(checked)}
              disabled={autoRecordMutation.isPending}
            />
          </div>
          
          {/* Sync button */}
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          
          <Button asChild variant="outline">
            <Link href="/settings/integrations">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">
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
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAYS.map((day) => (
              <div key={day} className="py-2 text-center text-sm font-medium text-slate-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 bg-slate-50" />
            ))}
            
            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`h-24 p-2 border-t border-slate-200 text-left transition-colors hover:bg-slate-50 ${
                    isSelected(day) ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset' : ''
                  } ${isToday(day) ? 'bg-primary-50' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                    isToday(day) ? 'bg-primary-500 text-white font-semibold' : 'text-slate-700'
                  }`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs truncate px-1 py-0.5 rounded bg-primary-100 text-primary-700"
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-slate-500">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>

          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No meetings scheduled
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <Video className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(event.start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {event.platform && ` · ${event.platform}`}
                        </p>
                        
                        {/* Bot status or record button */}
                        {event.meetingUrl && (
                          <div className="mt-2">
                            {event.botStatus ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.botStatus === 'recording' 
                                  ? 'bg-red-100 text-red-700'
                                  : event.botStatus === 'in_call'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {event.botStatus === 'recording' ? '● Recording' : event.botStatus}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendBotMutation.mutate(event)}
                                disabled={sendBotMutation.isPending}
                              >
                                {sendBotMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Send className="w-3 h-3 mr-1" />
                                )}
                                Record
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 13.6 Calendar API Routes

Create/update `apps/api/src/routes/calendar.ts` to add missing endpoints:

```typescript
// Add these endpoints:

/**
 * GET /calendar/status
 * Get calendar connection status
 */
router.get('/status', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.auth!.userId;

  const connection = await calendarRepository.findByUserId(userId);
  
  res.json({
    connection: connection ? {
      id: connection.id,
      provider: connection.provider,
      email: connection.email,
      autoRecord: connection.autoRecord || false,
      connectedAt: connection.createdAt,
    } : null,
  });
});

/**
 * GET /calendar/events
 * Get calendar events for a date range
 */
router.get('/events', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.auth!.userId;
  const { start, end } = req.query;

  const connection = await calendarRepository.findByUserId(userId);
  if (!connection) {
    return res.json({ events: [] });
  }

  const events = await googleCalendarService.getEvents(
    connection,
    new Date(start as string),
    new Date(end as string)
  );

  // Check if we have matching meetings in our system
  const eventsWithMeetings = await Promise.all(
    events.map(async (event) => {
      const meeting = await meetingRepository.findByCalendarEventId(event.id);
      return {
        ...event,
        meetingId: meeting?.id,
        botStatus: meeting?.botId ? await getBotStatusQuick(meeting.botId) : null,
      };
    })
  );

  res.json({ events: eventsWithMeetings });
});

/**
 * PUT /calendar/auto-record
 * Toggle auto-record setting
 */
router.put('/auto-record', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.auth!.userId;
  const { enabled } = req.body;

  await calendarRepository.updateByUserId(userId, { autoRecord: enabled });

  res.json({ success: true, autoRecord: enabled });
});
```

---

## 13.7 Database Schema Update

Add to `packages/database/prisma/schema.prisma`:

```prisma
// Update CalendarConnection model
model CalendarConnection {
  // ... existing fields ...
  autoRecord    Boolean   @default(false) @map("auto_record")
}

// Update Meeting model
model Meeting {
  // ... existing fields ...
  calendarEventId String?   @map("calendar_event_id")
  
  @@index([calendarEventId])
}
```

---

## 13.8 Auto-Record Job

Create `apps/api/src/jobs/autoRecordWorker.ts`:

```typescript
/**
 * Auto-record worker
 * Runs every 5 minutes, checks for upcoming meetings with auto-record enabled
 * and deploys bots automatically
 */

import { Queue, Worker, Job } from 'bullmq';
import { calendarRepository, meetingRepository, prisma } from '@zigznote/database';
import { googleCalendarService } from '../services/googleCalendarService';
import { recallService } from '../services/recallService';
import { logger } from '../utils/logger';
import { redis } from './queues';

const QUEUE_NAME = 'auto-record';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOOKAHEAD_MINUTES = 10; // Check meetings starting in next 10 minutes

export const autoRecordQueue = new Queue(QUEUE_NAME, { connection: redis });

// Schedule recurring check
export async function scheduleAutoRecordCheck() {
  await autoRecordQueue.add(
    'check-upcoming',
    {},
    {
      repeat: {
        every: CHECK_INTERVAL_MS,
      },
    }
  );
  logger.info('Auto-record check scheduled');
}

// Worker
export const autoRecordWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    logger.info('Running auto-record check');

    // Get all connections with auto-record enabled
    const connections = await prisma.calendarConnection.findMany({
      where: { autoRecord: true },
      include: { user: true },
    });

    const now = new Date();
    const lookahead = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60 * 1000);

    for (const connection of connections) {
      try {
        // Get upcoming events
        const events = await googleCalendarService.getEvents(connection, now, lookahead);

        for (const event of events) {
          // Skip if no meeting link
          if (!event.meetingLink) continue;

          // Check if we already have a meeting with a bot
          const existingMeeting = await meetingRepository.findByCalendarEventId(event.id);
          
          if (existingMeeting?.botId) {
            // Already has a bot, skip
            continue;
          }

          // Create meeting if needed
          let meetingId = existingMeeting?.id;
          
          if (!meetingId) {
            const meeting = await meetingRepository.create({
              organizationId: connection.user.organizationId,
              createdById: connection.userId,
              title: event.summary,
              meetingUrl: event.meetingLink,
              platform: event.platform || 'other',
              startTime: event.start,
              endTime: event.end,
              calendarEventId: event.id,
              status: 'scheduled',
            });
            meetingId = meeting.id;
          }

          // Deploy bot (scheduled to join at start time)
          const botStatus = await recallService.createBot({
            meetingId,
            organizationId: connection.user.organizationId,
            meetingUrl: event.meetingLink!,
            joinAt: event.start,
          });

          await meetingRepository.update(meetingId, { botId: botStatus.id });

          logger.info(
            { meetingId, eventId: event.id, botId: botStatus.id },
            'Auto-deployed bot for upcoming meeting'
          );
        }
      } catch (error) {
        logger.error({ error, connectionId: connection.id }, 'Auto-record check failed for connection');
      }
    }

    return { checked: connections.length };
  },
  { connection: redis }
);
```

---

## 13.9 Export Component Updates

Update `apps/web/components/meetings/index.ts`:

```typescript
export * from './MeetingCard';
export * from './MeetingList';
export * from './MeetingChat';
export * from './MeetingPlayer';
export * from './TranscriptViewer';
export * from './SummaryPanel';
export * from './ActionItems';
export * from './SpeakerEditor';
export * from './MeetingLinkInput';  // NEW
export * from './BotStatus';          // NEW
```

---

## 13.10 Testing Checklist

- [ ] Paste Zoom link → correct platform detected
- [ ] Paste Google Meet link → correct platform detected
- [ ] Paste Teams link → correct platform detected
- [ ] "Send Bot Now" creates meeting and deploys bot
- [ ] "Save for Later" creates meeting without bot
- [ ] Bot status shows in meeting detail page
- [ ] Can stop bot from meeting detail page
- [ ] Calendar page shows "Connect" when not connected
- [ ] After connecting Google Calendar, events appear
- [ ] Can click "Record" on calendar event
- [ ] Auto-record toggle works
- [ ] Sync button refreshes calendar
- [ ] Real-time bot status updates work

---

## Definition of Done

1. Users can paste meeting URLs and send bots
2. Calendar shows real Google Calendar data
3. Auto-record deploys bots to upcoming meetings
4. Bot status visible throughout the app
5. All platforms supported (Zoom, Meet, Teams, Webex)

---

## Estimated Time

| Task | Hours |
|------|-------|
| MeetingLinkInput component | 3 |
| BotStatus component | 2 |
| Update meeting detail page | 2 |
| Real calendar page | 4 |
| Calendar API endpoints | 2 |
| Auto-record worker | 3 |
| Testing & polish | 2 |
| **Total** | **~18 hours** |

---

## No New Paid Services

Uses existing:
- Recall.ai (already integrated)
- Google Calendar API (already integrated)
- Redis (for job queue)
