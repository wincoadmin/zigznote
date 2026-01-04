'use client';

import { useQuery } from '@tanstack/react-query';
import { StatsCards, RecentMeetings, UpcomingMeetings, QuickActions } from '@/components/dashboard';
import { meetingsApi } from '@/lib/api';
import type { Meeting } from '@/types';

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['meetingStats'],
    queryFn: async () => {
      const response = await meetingsApi.getStats();
      if (response.success && response.data) {
        return response.data as {
          meetingsThisWeek: number;
          hoursRecorded: number;
          actionItemsPending: number;
          completionRate: number;
        };
      }
      // Return mock data for now
      return {
        meetingsThisWeek: 12,
        hoursRecorded: 8.5,
        actionItemsPending: 7,
        completionRate: 85,
      };
    },
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['recentMeetings'],
    queryFn: async () => {
      const response = await meetingsApi.getRecent();
      if (response.success && response.data) {
        return response.data as Meeting[];
      }
      return [] as Meeting[];
    },
  });

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcomingMeetings'],
    queryFn: async () => {
      const response = await meetingsApi.getUpcoming();
      if (response.success && response.data) {
        return response.data as Meeting[];
      }
      return [] as Meeting[];
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Welcome back
        </h1>
        <p className="text-slate-500">
          Here&apos;s what&apos;s happening with your meetings
        </p>
      </div>

      {/* Stats cards */}
      <StatsCards stats={statsData} isLoading={statsLoading} />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent meetings - spans 2 columns */}
        <div className="lg:col-span-2">
          <RecentMeetings meetings={recentData} isLoading={recentLoading} />
        </div>

        {/* Sidebar - Quick actions and upcoming */}
        <div className="space-y-6">
          <QuickActions />
          <UpcomingMeetings meetings={upcomingData} isLoading={upcomingLoading} />
        </div>
      </div>
    </div>
  );
}
