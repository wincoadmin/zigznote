'use client';

import { Video, Clock, CheckSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  className?: string;
}

function StatCard({ title, value, change, trend, icon, className }: StatCardProps) {
  return (
    <Card className={cn('hover:shadow-lg', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 font-heading text-3xl font-bold text-slate-900">
              {value}
            </p>
            {change && (
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-sm font-medium',
                  trend === 'up' && 'text-green-600',
                  trend === 'down' && 'text-red-600',
                  trend === 'neutral' && 'text-slate-500'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {change}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsCardsProps {
  stats?: {
    meetingsThisWeek: number;
    hoursRecorded: number;
    actionItemsPending: number;
    completionRate: number;
  };
  isLoading?: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const displayStats = stats || {
    meetingsThisWeek: 0,
    hoursRecorded: 0,
    actionItemsPending: 0,
    completionRate: 0,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Meetings This Week"
        value={displayStats.meetingsThisWeek}
        change="+12% from last week"
        trend="up"
        icon={<Video className="h-6 w-6" />}
      />
      <StatCard
        title="Hours Recorded"
        value={`${displayStats.hoursRecorded}h`}
        change="+5% from last week"
        trend="up"
        icon={<Clock className="h-6 w-6" />}
      />
      <StatCard
        title="Action Items Pending"
        value={displayStats.actionItemsPending}
        change="3 due today"
        trend="neutral"
        icon={<CheckSquare className="h-6 w-6" />}
      />
      <StatCard
        title="Completion Rate"
        value={`${displayStats.completionRate}%`}
        change="+8% improvement"
        trend="up"
        icon={<TrendingUp className="h-6 w-6" />}
      />
    </div>
  );
}
