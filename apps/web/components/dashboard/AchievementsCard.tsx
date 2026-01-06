'use client';

import { Trophy, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  points: number;
}

interface AchievementsCardProps {
  achievements: Achievement[];
  isLoading?: boolean;
}

export function AchievementsCard({ achievements, isLoading = false }: AchievementsCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm animate-pulse">
        <div className="h-5 sm:h-6 w-24 sm:w-32 bg-slate-200 rounded mb-3 sm:mb-4" />
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 sm:h-16 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Sort: unlocked first, then by progress
  const sortedAchievements = [...achievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return (b.progress || 0) - (a.progress || 0);
  });

  // Show first 8 achievements
  const displayedAchievements = sortedAchievements.slice(0, 8);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalPoints = achievements
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + a.points, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900">Achievements</h3>
        </div>
        <div className="text-xs sm:text-sm text-slate-500">
          {unlockedCount}/{achievements.length}
        </div>
      </div>

      {/* Total points */}
      <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-amber-700">Total Points</span>
          <span className="text-lg sm:text-xl font-bold text-amber-600">{totalPoints}</span>
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
        {displayedAchievements.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </div>

      {/* View all link */}
      <Link
        href="/achievements"
        className="flex items-center justify-center gap-1 text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        View all
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
      </Link>
    </div>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const { unlocked, icon, name, progress } = achievement;

  return (
    <div
      className={`relative group flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border transition-all ${
        unlocked
          ? 'bg-amber-50 border-amber-200 cursor-default'
          : 'bg-slate-50 border-slate-200 cursor-help'
      }`}
      title={`${name}${!unlocked && progress ? ` (${Math.round(progress)}%)` : ''}`}
    >
      {/* Icon */}
      <span
        className={`text-lg sm:text-2xl ${unlocked ? '' : 'grayscale opacity-50'}`}
      >
        {icon}
      </span>

      {/* Lock overlay for locked achievements */}
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 rounded-lg">
          <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
        </div>
      )}

      {/* Progress indicator for locked achievements */}
      {!unlocked && progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0.5 sm:bottom-1 left-0.5 sm:left-1 right-0.5 sm:right-1">
          <div className="h-0.5 sm:h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-400 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 sm:mb-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-900 text-white text-[10px] sm:text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {name}
        {!unlocked && progress !== undefined && ` (${Math.round(progress)}%)`}
      </div>
    </div>
  );
}
