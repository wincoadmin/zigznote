'use client';

import { useState } from 'react';
import { Bell, Mail, Calendar, CreditCard, Share2, BarChart3 } from 'lucide-react';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      id: 'meetingReady',
      label: 'Meeting ready',
      description: 'Get notified when your meeting transcript and summary are ready',
      icon: <Mail className="h-5 w-5 text-slate-400" />,
      enabled: true,
    },
    {
      id: 'actionItemReminder',
      label: 'Action item reminders',
      description: 'Receive reminders for upcoming action item due dates',
      icon: <Calendar className="h-5 w-5 text-slate-400" />,
      enabled: true,
    },
    {
      id: 'weeklyDigest',
      label: 'Weekly digest',
      description: 'Receive a weekly summary of your meetings and insights',
      icon: <BarChart3 className="h-5 w-5 text-slate-400" />,
      enabled: false,
    },
    {
      id: 'meetingShared',
      label: 'Meeting shared',
      description: 'Get notified when someone shares a meeting with you',
      icon: <Share2 className="h-5 w-5 text-slate-400" />,
      enabled: true,
    },
    {
      id: 'paymentAlerts',
      label: 'Payment alerts',
      description: 'Receive notifications about payment success or failures',
      icon: <CreditCard className="h-5 w-5 text-slate-400" />,
      enabled: true,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const togglePreference = (id: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setMessage('Preferences saved successfully!');
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500">
          Manage how and when you receive notifications from zigznote
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary-500" />
            <h3 className="font-medium text-slate-900">Email Notifications</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Choose which email notifications you want to receive
          </p>
        </div>

        <div className="p-6 space-y-6">
          {preferences.map((pref) => (
            <div key={pref.id} className="flex items-start gap-4">
              <div className="mt-0.5">{pref.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{pref.label}</p>
                    <p className="text-sm text-slate-500">{pref.description}</p>
                  </div>
                  <button
                    onClick={() => togglePreference(pref.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      pref.enabled ? 'bg-primary-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pref.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          {message && (
            <p className="text-sm text-green-600">{message}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
