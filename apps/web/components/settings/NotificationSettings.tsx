'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, Calendar, CreditCard, Share2, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi, NotificationPreferences } from '@/lib/api';

interface NotificationSettingsProps {
  className?: string;
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await settingsApi.getNotifications();
      if (response.success && response.data) {
        setPreferences(response.data);
      } else {
        setError('Failed to load notification preferences');
      }
    } catch {
      setError('Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean | number) => {
    if (!preferences) return;

    const previousValue = preferences[key];
    setPreferences({ ...preferences, [key]: value });
    setIsSaving(true);

    try {
      const response = await settingsApi.updateNotifications({ [key]: value });
      if (!response.success) {
        setPreferences({ ...preferences, [key]: previousValue });
        setError('Failed to save preference');
      }
    } catch {
      setPreferences({ ...preferences, [key]: previousValue });
      setError('Failed to save preference');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2 sm:gap-3">
              <Skeleton className="h-6 w-11 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error && !preferences) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <p className="text-center text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary-500" />
          <CardTitle>Email Notifications</CardTitle>
        </div>
        <CardDescription>
          Choose which email notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2 sm:gap-4">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mt-0.5 shrink-0" />
            <Switch
              checked={preferences?.emailMeetingReady ?? true}
              onChange={(e) => updatePreference('emailMeetingReady', e.target.checked)}
              disabled={isSaving}
              label="Meeting ready"
              description="Get notified when your meeting transcript and summary are ready"
            />
          </div>

          <div className="flex items-start gap-2 sm:gap-4">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <Switch
                checked={preferences?.emailActionItemReminder ?? true}
                onChange={(e) => updatePreference('emailActionItemReminder', e.target.checked)}
                disabled={isSaving}
                label="Action item reminders"
                description="Receive reminders for upcoming action item due dates"
              />
              {preferences?.emailActionItemReminder && (
                <div className="mt-3 ml-0">
                  <Select
                    value={String(preferences?.actionItemReminderDays ?? 1)}
                    onChange={(e) => updatePreference('actionItemReminderDays', parseInt(e.target.value))}
                    disabled={isSaving}
                    className="w-48"
                  >
                    <option value="1">1 day before</option>
                    <option value="2">2 days before</option>
                    <option value="3">3 days before</option>
                    <option value="5">5 days before</option>
                    <option value="7">7 days before</option>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-4">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mt-0.5 shrink-0" />
            <Switch
              checked={preferences?.emailWeeklyDigest ?? true}
              onChange={(e) => updatePreference('emailWeeklyDigest', e.target.checked)}
              disabled={isSaving}
              label="Weekly digest"
              description="Receive a weekly summary of your meetings and insights"
            />
          </div>

          <div className="flex items-start gap-2 sm:gap-4">
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mt-0.5 shrink-0" />
            <Switch
              checked={preferences?.emailMeetingShared ?? true}
              onChange={(e) => updatePreference('emailMeetingShared', e.target.checked)}
              disabled={isSaving}
              label="Meeting shared"
              description="Get notified when someone shares a meeting with you"
            />
          </div>

          <div className="flex items-start gap-2 sm:gap-4">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mt-0.5 shrink-0" />
            <Switch
              checked={preferences?.emailPaymentAlerts ?? true}
              onChange={(e) => updatePreference('emailPaymentAlerts', e.target.checked)}
              disabled={isSaving}
              label="Payment alerts"
              description="Receive notifications about payment success or failures"
            />
          </div>
        </div>

        {error && preferences && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
