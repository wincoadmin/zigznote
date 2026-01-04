'use client';

import { useState } from 'react';
import { Check, Circle, Trash2, User, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { ActionItem } from '@/types';

interface ActionItemsProps {
  actionItems?: ActionItem[];
  isLoading?: boolean;
  onToggle?: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function ActionItems({
  actionItems = [],
  isLoading,
  onToggle,
  onDelete,
  className,
}: ActionItemsProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const pendingItems = actionItems.filter((item) => !item.completed);
  const completedItems = actionItems.filter((item) => item.completed);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Action Items</CardTitle>
          <span className="text-sm text-slate-500">
            {pendingItems.length} pending
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {actionItems.length === 0 ? (
          <p className="text-center text-slate-500 py-4">
            No action items for this meeting
          </p>
        ) : (
          <div className="space-y-4">
            {/* Pending items */}
            {pendingItems.length > 0 && (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}

            {/* Completed items */}
            {completedItems.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-500">
                  Completed ({completedItems.length})
                </h4>
                <div className="space-y-2">
                  {completedItems.map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onToggle={onToggle}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActionItemRowProps {
  item: ActionItem;
  onToggle?: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
}

function ActionItemRow({ item, onToggle, onDelete }: ActionItemRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    await onToggle?.(item.id, !item.completed);
    setIsUpdating(false);
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors',
        item.completed ? 'bg-slate-50' : 'hover:bg-slate-50'
      )}
    >
      <button
        onClick={handleToggle}
        disabled={isUpdating}
        className="mt-0.5 shrink-0"
        data-testid="action-item-checkbox"
      >
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
            item.completed
              ? 'border-primary-500 bg-primary-500 text-white'
              : 'border-slate-300 hover:border-primary-500'
          )}
        >
          {item.completed && <Check className="h-3 w-3" />}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm',
            item.completed ? 'text-slate-500 line-through' : 'text-slate-900'
          )}
        >
          {item.text}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {item.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {item.assignee}
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
        </div>
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
          aria-label="Delete action item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
