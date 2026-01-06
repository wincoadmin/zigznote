'use client';

import { Calendar, Clock, Mic, TrendingUp } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Welcome back, {userName}
        </h1>
        <p className="text-slate-600">
          Here&apos;s what&apos;s happening with your meetings.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Meetings this week"
          value="12"
          change="+3 from last week"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Hours recorded"
          value="8.5"
          change="2.5 hrs today"
        />
        <StatCard
          icon={<Mic className="h-5 w-5" />}
          label="Action items"
          value="24"
          change="8 completed"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Time saved"
          value="4.2 hrs"
          change="This month"
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upcoming Meetings */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Upcoming Meetings
            </h2>
            <div className="mt-4 space-y-4">
              <MeetingCard
                title="Product Sync"
                time="Today, 2:00 PM"
                platform="Zoom"
                status="scheduled"
              />
              <MeetingCard
                title="Client Discovery Call"
                time="Today, 4:30 PM"
                platform="Google Meet"
                status="scheduled"
              />
              <MeetingCard
                title="Weekly Standup"
                time="Tomorrow, 9:00 AM"
                platform="Teams"
                status="scheduled"
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="card">
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Recent Activity
            </h2>
            <div className="mt-4 space-y-3">
              <ActivityItem
                text="Summary generated for Sales Demo"
                time="10 min ago"
              />
              <ActivityItem
                text="3 action items extracted"
                time="10 min ago"
              />
              <ActivityItem
                text="Recording completed"
                time="45 min ago"
              />
              <ActivityItem
                text="Bot joined Client Call"
                time="1 hour ago"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  change,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary-100 p-2 text-primary-600">
          {icon}
        </div>
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <div className="mt-3">
        <span className="font-heading text-3xl font-bold text-slate-900">
          {value}
        </span>
        <p className="mt-1 text-xs text-slate-500">{change}</p>
      </div>
    </div>
  );
}

function MeetingCard({
  title,
  time,
  platform,
  status,
}: {
  title: string;
  time: string;
  platform: string;
  status: 'scheduled' | 'recording' | 'completed';
}) {
  const statusColors = {
    scheduled: 'bg-slate-100 text-slate-600',
    recording: 'bg-red-100 text-red-600',
    completed: 'bg-primary-100 text-primary-600',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50">
      <div>
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">
          {time} &middot; {platform}
        </p>
      </div>
      <span className={`tag ${statusColors[status]}`}>{status}</span>
    </div>
  );
}

function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary-500" />
      <div className="flex-1">
        <p className="text-sm text-slate-700">{text}</p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
    </div>
  );
}
