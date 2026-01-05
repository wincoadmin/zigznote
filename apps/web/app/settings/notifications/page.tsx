'use client';

import { NotificationSettings } from '@/components/settings';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500">
          Manage how and when you receive notifications from zigznote
        </p>
      </div>

      <NotificationSettings />
    </div>
  );
}
