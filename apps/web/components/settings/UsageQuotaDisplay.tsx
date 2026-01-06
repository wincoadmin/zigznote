'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, HardDrive, MessageCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { settingsApi, UsageSummary, UsageMetric } from '@/lib/api';

interface UsageQuotaDisplayProps {
  className?: string;
  compact?: boolean;
}

interface QuotaItemProps {
  icon: typeof Calendar;
  label: string;
  metric: UsageMetric;
  unit?: string;
  compact?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return String(num);
}

function formatStorage(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  }
  if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function QuotaItem({ icon: Icon, label, metric, unit, compact }: QuotaItemProps) {
  const isUnlimited = metric.limit === -1;
  const percentage = isUnlimited ? 0 : metric.percentage;
  const isWarning = percentage >= 80 && percentage < 100;
  const isOverLimit = percentage >= 100;

  const displayCurrent = unit === 'storage' ? formatStorage(metric.current) : formatNumber(metric.current);
  const displayLimit = isUnlimited
    ? 'Unlimited'
    : unit === 'storage'
    ? formatStorage(metric.limit)
    : formatNumber(metric.limit);

  if (compact) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Icon className={cn(
          'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
          isOverLimit ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-600 truncate">{label}</span>
            <span className={cn(
              'font-medium shrink-0 ml-2',
              isOverLimit ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-900'
            )}>
              {displayCurrent} / {displayLimit}
            </span>
          </div>
          {!isUnlimited && (
            <Progress
              value={Math.min(percentage, 100)}
              max={100}
              className={cn(
                'mt-1 h-1.5',
                isOverLimit && '[&>div]:bg-red-500',
                isWarning && '[&>div]:bg-amber-500'
              )}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 p-3 sm:p-4">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className={cn(
            'rounded-lg p-1.5 sm:p-2',
            isOverLimit ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-slate-50'
          )}>
            <Icon className={cn(
              'h-4 w-4 sm:h-5 sm:w-5',
              isOverLimit ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{label}</p>
            {!isUnlimited && (
              <p className={cn(
                'text-xs',
                isOverLimit ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'
              )}>
                {percentage.toFixed(0)}% used
              </p>
            )}
          </div>
        </div>
        {isOverLimit && (
          <Badge variant="error" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Over limit
          </Badge>
        )}
        {isWarning && !isOverLimit && (
          <Badge variant="warning" className="text-xs">
            Almost full
          </Badge>
        )}
      </div>

      {!isUnlimited && (
        <Progress
          value={Math.min(percentage, 100)}
          max={100}
          className={cn(
            'mb-2',
            isOverLimit && '[&>div]:bg-red-500',
            isWarning && '[&>div]:bg-amber-500'
          )}
        />
      )}

      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="text-slate-500">Used</span>
        <span className={cn(
          'font-medium',
          isOverLimit ? 'text-red-600' : 'text-slate-900'
        )}>
          {displayCurrent}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="text-slate-500">Limit</span>
        <span className="font-medium text-slate-900">{displayLimit}</span>
      </div>
    </div>
  );
}

export function UsageQuotaDisplay({ className, compact = false }: UsageQuotaDisplayProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await settingsApi.getUsage();
      if (response.success && response.data) {
        setUsage(response.data);
      } else {
        setError('Failed to load usage data');
      }
    } catch {
      setError('Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <div className={compact ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className={compact ? 'h-8' : 'h-32'} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !usage) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <p className="text-center text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'enterprise':
        return 'default';
      case 'pro':
        return 'success';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usage & Quotas</CardTitle>
            <CardDescription>
              Current billing period: {usage.period}
            </CardDescription>
          </div>
          <Badge variant={getPlanBadgeVariant(usage.plan)} className="capitalize">
            {usage.plan} Plan
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className={compact ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
          <QuotaItem
            icon={Calendar}
            label="Meetings"
            metric={usage.usage.meetings}
            compact={compact}
          />
          <QuotaItem
            icon={Clock}
            label="Meeting Minutes"
            metric={usage.usage.minutes}
            compact={compact}
          />
          <QuotaItem
            icon={HardDrive}
            label="Storage"
            metric={usage.usage.storage}
            unit="storage"
            compact={compact}
          />
          <QuotaItem
            icon={MessageCircle}
            label="AI Chat Tokens"
            metric={usage.usage.chat}
            compact={compact}
          />
        </div>

        {usage.plan === 'free' && (
          <div className="mt-6 rounded-lg bg-gradient-to-r from-primary-50 to-primary-100 p-4 border border-primary-200">
            <p className="text-sm font-medium text-primary-900">
              Need more capacity?
            </p>
            <p className="text-sm text-primary-700 mt-1">
              Upgrade to Pro for 10x more meetings, minutes, and storage.
            </p>
            <button className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700">
              View pricing →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
