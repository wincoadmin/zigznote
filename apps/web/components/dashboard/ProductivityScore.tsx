'use client';

import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface ProductivityScoreProps {
  score: number;
  components: {
    meetingEfficiency: number;
    actionItemCompletion: number;
    engagementStreak: number;
  };
  trend: 'up' | 'down' | 'stable';
  isLoading?: boolean;
}

export function ProductivityScore({
  score,
  components,
  trend,
  isLoading = false,
}: ProductivityScoreProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded mb-4" />
        <div className="h-20 w-20 bg-slate-200 rounded-full mx-auto mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400';
  const trendLabel = trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable';

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary-500" />
          <h3 className="font-semibold text-slate-900">Productivity Score</h3>
        </div>
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span>{trendLabel}</span>
        </div>
      </div>

      {/* Score circle */}
      <div className="flex justify-center mb-6">
        <div className="relative w-24 h-24">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${score * 2.83} 283`}
              className={getScoreColor(score)}
            />
          </svg>
          {/* Score text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
              {score}
            </span>
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-3">
        <ScoreBar
          label="Meeting Efficiency"
          value={components.meetingEfficiency}
        />
        <ScoreBar
          label="Action Item Completion"
          value={components.actionItemCompletion}
        />
        <ScoreBar
          label="Engagement Streak"
          value={components.engagementStreak}
        />
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-green-500';
    if (v >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
