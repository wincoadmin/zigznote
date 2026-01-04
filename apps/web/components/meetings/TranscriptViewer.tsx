'use client';

import { useRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '@/types';

// Speaker colors for visual differentiation
const speakerColors = [
  'border-l-primary-500 bg-primary-50',
  'border-l-blue-500 bg-blue-50',
  'border-l-purple-500 bg-purple-50',
  'border-l-amber-500 bg-amber-50',
  'border-l-rose-500 bg-rose-50',
  'border-l-cyan-500 bg-cyan-50',
];

interface TranscriptViewerProps {
  segments?: TranscriptSegment[];
  currentTimeMs?: number;
  onSegmentClick?: (startMs: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function TranscriptViewer({
  segments = [],
  currentTimeMs = 0,
  onSegmentClick,
  isLoading,
  className,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  // Map speakers to colors
  const speakerColorMap = new Map<string, string>();
  segments.forEach((segment) => {
    if (!speakerColorMap.has(segment.speaker)) {
      speakerColorMap.set(
        segment.speaker,
        speakerColors[speakerColorMap.size % speakerColors.length]
      );
    }
  });

  // Find current segment
  const currentSegmentIndex = segments.findIndex(
    (segment) => segment.startMs <= currentTimeMs && segment.endMs >= currentTimeMs
  );

  // Auto-scroll to current segment
  useEffect(() => {
    if (autoScroll && currentSegmentIndex >= 0 && containerRef.current) {
      const segmentEl = containerRef.current.querySelector(
        `[data-segment-index="${currentSegmentIndex}"]`
      );
      if (segmentEl) {
        segmentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSegmentIndex, autoScroll]);

  // Handle user scroll (disable auto-scroll temporarily)
  const handleScroll = () => {
    setAutoScroll(false);
    // Re-enable after 5 seconds of no scrolling
    const timeout = setTimeout(() => setAutoScroll(true), 5000);
    return () => clearTimeout(timeout);
  };

  // Filter segments by search query
  const filteredSegments = searchQuery
    ? segments.filter((s) =>
        s.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments;

  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4 rounded-lg border border-slate-200 bg-white p-4', className)}>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg border border-slate-200 bg-white p-8', className)}>
        <p className="text-slate-500">No transcript available</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col rounded-lg border border-slate-200 bg-white', className)}>
      {/* Search header */}
      <div className="border-b border-slate-200 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ maxHeight: '500px' }}
        onScroll={handleScroll}
      >
        <div className="space-y-3">
          {filteredSegments.map((segment, index) => {
            const actualIndex = segments.indexOf(segment);
            const isActive = actualIndex === currentSegmentIndex;
            const colorClass = speakerColorMap.get(segment.speaker) || speakerColors[0];

            return (
              <div
                key={index}
                data-segment-index={actualIndex}
                onClick={() => onSegmentClick?.(segment.startMs)}
                className={cn(
                  'cursor-pointer rounded-lg border-l-4 p-3 transition-all',
                  colorClass,
                  isActive && 'ring-2 ring-primary-500',
                  !isActive && 'hover:bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-slate-900">
                    {segment.speaker}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSegmentClick?.(segment.startMs);
                    }}
                    className="font-mono text-xs text-slate-500 hover:text-primary-600"
                  >
                    {formatTimestamp(segment.startMs)}
                  </button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {searchQuery ? (
                    highlightText(segment.text, searchQuery)
                  ) : (
                    segment.text
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper to highlight search matches
function highlightText(text: string, query: string) {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
