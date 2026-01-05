'use client';

/**
 * Time Saved Widget
 * Shows estimated time saved with animated counter
 */

import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Clock, TrendingUp, Sparkles } from 'lucide-react';

interface TimeSavedWidgetProps {
  totalMinutes: number;
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
  className?: string;
}

/**
 * Animated number counter component
 */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { damping: 30, stiffness: 100 });
  const display = useTransform(spring, (current) => Math.round(current));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    return display.on('change', (v) => setDisplayValue(v));
  }, [display]);

  return <span>{displayValue}</span>;
}

export function TimeSavedWidget({
  totalMinutes,
  trend = 'stable',
  trendPercentage = 0,
  className = '',
}: TimeSavedWidgetProps) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Calculate equivalent activities
  const coffeeBreaks = Math.round(totalMinutes / 15); // 15 min coffee breaks
  const focusSessions = Math.round(totalMinutes / 25); // Pomodoro sessions

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 dark:from-amber-900/20 dark:to-orange-900/20 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-800/40">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            Time Saved
          </span>
        </div>
        {trend !== 'stable' && (
          <div
            className={`flex items-center gap-1 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <TrendingUp
              className={`h-4 w-4 ${trend === 'down' ? 'rotate-180' : ''}`}
            />
            <span>{trendPercentage}%</span>
          </div>
        )}
      </div>

      {/* Main stat */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-amber-600 dark:text-amber-400">
            <AnimatedNumber value={hours} />
          </span>
          <span className="text-lg text-gray-600 dark:text-gray-400">hours</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            <AnimatedNumber value={minutes} />
          </span>
          <span className="text-lg text-gray-600 dark:text-gray-400">min</span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Estimated time saved this month
        </p>
      </div>

      {/* Fun equivalents */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg bg-white/60 p-3 dark:bg-gray-800/40"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">☕</span>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {coffeeBreaks}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Coffee breaks
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-lg bg-white/60 p-3 dark:bg-gray-800/40"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {focusSessions}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Focus sessions
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Motivational footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
      >
        <Sparkles className="h-4 w-4" />
        <span>Keep it up! You&apos;re doing great.</span>
      </motion.div>
    </motion.div>
  );
}

export default TimeSavedWidget;
