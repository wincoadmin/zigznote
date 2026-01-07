'use client';

import { useState } from 'react';
import { Video, Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
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

const PLATFORM_INFO: Record<Platform, { name: string; color: string; bgColor: string }> = {
  zoom: { name: 'Zoom', color: 'text-white', bgColor: 'bg-blue-500' },
  meet: { name: 'Google Meet', color: 'text-white', bgColor: 'bg-green-500' },
  teams: { name: 'Teams', color: 'text-white', bgColor: 'bg-purple-500' },
  webex: { name: 'Webex', color: 'text-white', bgColor: 'bg-red-500' },
  other: { name: 'Other', color: 'text-white', bgColor: 'bg-slate-500' },
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

type Step = 'input' | 'confirm' | 'schedule' | 'joining';

export function MeetingLinkInput({ onMeetingCreated }: MeetingLinkInputProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('input');

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
        startTime: joinAt,
      });

      if (!createResponse.success || !createResponse.data) {
        throw new Error(createResponse.error?.message || 'Failed to create meeting');
      }

      const meetingData = createResponse.data as { id: string };
      const meetingId = meetingData.id;

      if (mode === 'now' || mode === 'schedule') {
        // Step 2: Deploy bot (immediately or scheduled)
        const botResponse = await fetch(`/api/meetings/${meetingId}/bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joinAt: joinAt,
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

  const handleBack = () => {
    if (step === 'schedule') {
      setStep('confirm');
    } else if (step === 'confirm') {
      setStep('input');
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
                  <span className={`px-2 py-0.5 rounded text-xs ${platformInfo.color} ${platformInfo.bgColor}`}>
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
                <div className={`p-3 rounded-lg ${platformInfo.bgColor} text-white text-lg font-semibold`}>
                  {platformInfo.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900">
                    {title || `${platformInfo.name} Meeting`}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{url}</p>
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
            onClick={handleBack}
            className="w-full"
          >
            Back
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
                <div className={`p-3 rounded-lg ${platformInfo.bgColor} text-white text-lg font-semibold`}>
                  {platformInfo.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900">
                    {title || `${platformInfo.name} Meeting`}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{url}</p>
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
            onClick={handleBack}
            className="w-full"
          >
            Back
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
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
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
          <li>Our bot joins as &quot;Zigznote Notetaker&quot;</li>
          <li>The bot records and transcribes the meeting</li>
          <li>Get your summary and action items when it ends</li>
        </ol>
      </div>
    </div>
  );
}
