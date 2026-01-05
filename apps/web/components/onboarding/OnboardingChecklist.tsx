'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Rocket,
  Settings,
  Video,
  X,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  onDismiss?: () => void;
  className?: string;
}

const defaultItems: ChecklistItem[] = [
  {
    id: 'calendar',
    title: 'Connect your calendar',
    description: 'Sync meetings from Google or Outlook',
    href: '/settings',
    icon: <Calendar className="w-5 h-5" />,
    completed: false,
  },
  {
    id: 'first-meeting',
    title: 'Record your first meeting',
    description: 'Let zigznote join and transcribe',
    href: '/meetings',
    icon: <Video className="w-5 h-5" />,
    completed: false,
  },
  {
    id: 'explore-ai',
    title: 'Try the AI assistant',
    description: 'Ask questions about a meeting',
    href: '/meetings',
    icon: <Rocket className="w-5 h-5" />,
    completed: false,
  },
  {
    id: 'help',
    title: 'Explore the help center',
    description: 'Learn tips and best practices',
    href: '/help',
    icon: <HelpCircle className="w-5 h-5" />,
    completed: false,
  },
];

export function OnboardingChecklist({
  items = defaultItems,
  onDismiss,
  className,
}: OnboardingChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  if (completedCount === items.length && onDismiss) {
    return null;
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        className="cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <CardTitle className="text-base">Getting Started</CardTitle>
              <p className="text-sm text-slate-500">
                {completedCount} of {items.length} complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-start gap-3 p-3 -mx-3 rounded-lg transition-colors',
                    item.completed
                      ? 'text-slate-400'
                      : 'hover:bg-slate-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      item.completed
                        ? 'bg-green-100 text-green-600'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      item.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-medium',
                        item.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-sm text-slate-500">{item.description}</p>
                  </div>
                  {!item.completed && (
                    <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg] mt-1" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
