'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Plus,
  X,
  Loader2,
  Highlighter,
  CheckSquare,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Flag,
  XCircle,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { annotationsApi, type Annotation, type AnnotationLabel } from '@/lib/api';

interface AnnotationBarProps {
  meetingId: string;
  className?: string;
  onAnnotationClick?: (annotation: Annotation) => void;
}

// Label icons
const LABEL_ICONS: Record<AnnotationLabel, React.ReactNode> = {
  HIGHLIGHT: <Highlighter className="w-3.5 h-3.5" />,
  ACTION_ITEM: <CheckSquare className="w-3.5 h-3.5" />,
  DECISION: <Flag className="w-3.5 h-3.5" />,
  QUESTION: <HelpCircle className="w-3.5 h-3.5" />,
  IMPORTANT: <AlertTriangle className="w-3.5 h-3.5" />,
  FOLLOW_UP: <ArrowRight className="w-3.5 h-3.5" />,
  BLOCKER: <XCircle className="w-3.5 h-3.5" />,
  IDEA: <Lightbulb className="w-3.5 h-3.5" />,
};

// Label colors from the backend
const LABEL_COLORS: Record<AnnotationLabel, string> = {
  HIGHLIGHT: '#FEF3C7',
  ACTION_ITEM: '#DBEAFE',
  DECISION: '#D1FAE5',
  QUESTION: '#FCE7F3',
  IMPORTANT: '#FEE2E2',
  FOLLOW_UP: '#E0E7FF',
  BLOCKER: '#FED7AA',
  IDEA: '#DDD6FE',
};

const LABEL_NAMES: Record<AnnotationLabel, string> = {
  HIGHLIGHT: 'Highlight',
  ACTION_ITEM: 'Action Item',
  DECISION: 'Decision',
  QUESTION: 'Question',
  IMPORTANT: 'Important',
  FOLLOW_UP: 'Follow Up',
  BLOCKER: 'Blocker',
  IDEA: 'Idea',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AnnotationItemProps {
  annotation: Annotation;
  onDelete: () => void;
  onClick?: () => void;
}

function AnnotationItem({ annotation, onDelete, onClick }: AnnotationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors'
      )}
      style={{ backgroundColor: `${LABEL_COLORS[annotation.label]}20` }}
      onClick={onClick}
    >
      <div
        className="flex-shrink-0 p-1.5 rounded"
        style={{ backgroundColor: LABEL_COLORS[annotation.label] }}
      >
        {LABEL_ICONS[annotation.label]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {LABEL_NAMES[annotation.label]}
          </span>
          <span className="text-xs text-slate-500">
            {formatTime(annotation.startTime)} - {formatTime(annotation.endTime)}
          </span>
        </div>
        {annotation.text && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
            {annotation.text}
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          by {annotation.user.name || annotation.user.email}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function AnnotationBar({ meetingId, className, onAnnotationClick }: AnnotationBarProps) {
  const [selectedLabel, setSelectedLabel] = useState<AnnotationLabel | null>(null);
  const queryClient = useQueryClient();

  // Fetch annotations
  const { data: annotationsData, isLoading } = useQuery({
    queryKey: ['annotations', meetingId],
    queryFn: async () => {
      const response = await annotationsApi.getAnnotations(meetingId);
      return response.success ? response.data || [] : [];
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['annotations-stats', meetingId],
    queryFn: async () => {
      const response = await annotationsApi.getStats(meetingId);
      return response.success ? response.data : null;
    },
  });

  const annotations = annotationsData || [];
  const stats = statsData;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (annotationId: string) => annotationsApi.delete(annotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['annotations-stats', meetingId] });
    },
  });

  // Filter annotations by label
  const filteredAnnotations = selectedLabel
    ? annotations.filter((a) => a.label === selectedLabel)
    : annotations;

  // Group annotations by label for summary
  const annotationsByLabel = annotations.reduce((acc, annotation) => {
    if (!acc[annotation.label]) {
      acc[annotation.label] = [];
    }
    acc[annotation.label].push(annotation);
    return acc;
  }, {} as Record<AnnotationLabel, Annotation[]>);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <Tag className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Annotations</h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          ({annotations.length})
        </span>
      </div>

      {/* Label filters */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <button
            onClick={() => setSelectedLabel(null)}
            className={cn(
              'px-2 py-1 text-xs rounded-full transition-colors',
              selectedLabel === null
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            All
          </button>
          {(Object.keys(LABEL_NAMES) as AnnotationLabel[]).map((label) => {
            const count = stats?.byLabel?.[label] || 0;
            if (count === 0) return null;
            return (
              <button
                key={label}
                onClick={() => setSelectedLabel(selectedLabel === label ? null : label)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors',
                  selectedLabel === label
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
                style={
                  selectedLabel === label
                    ? { backgroundColor: LABEL_COLORS[label] }
                    : undefined
                }
              >
                {LABEL_ICONS[label]}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Annotations list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredAnnotations.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {selectedLabel ? `No ${LABEL_NAMES[selectedLabel]} annotations` : 'No annotations yet'}
            </p>
            <p className="text-xs mt-1">
              Select text in the transcript to add annotations
            </p>
          </div>
        ) : (
          filteredAnnotations
            .sort((a, b) => a.startTime - b.startTime)
            .map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                onDelete={() => {
                  if (confirm('Delete this annotation?')) {
                    deleteMutation.mutate(annotation.id);
                  }
                }}
                onClick={() => onAnnotationClick?.(annotation)}
              />
            ))
        )}
      </div>

      {/* Summary footer */}
      {stats && stats.total > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Summary</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(stats.byLabel) as [AnnotationLabel, number][])
              .filter(([, count]) => count > 0)
              .map(([label, count]) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ backgroundColor: `${LABEL_COLORS[label]}40` }}
                >
                  {LABEL_ICONS[label]}
                  <span className="font-medium">{count}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {LABEL_NAMES[label]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationBar;
