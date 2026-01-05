'use client';

import Link from 'next/link';
import {
  Video,
  FileText,
  ListChecks,
  ClipboardList,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface SearchResult {
  id: string;
  type: 'meeting' | 'transcript' | 'summary' | 'action_item';
  title: string;
  preview: string;
  highlights: string[];
  score: number;
  meetingId: string;
  meetingTitle?: string;
  meetingDate?: string;
  createdAt: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading?: boolean;
  total?: number;
  took?: number;
}

const typeIcons = {
  meeting: Video,
  transcript: FileText,
  summary: ClipboardList,
  action_item: ListChecks,
};

const typeLabels = {
  meeting: 'Meeting',
  transcript: 'Transcript',
  summary: 'Summary',
  action_item: 'Action Item',
};

const typeColors = {
  meeting: 'bg-blue-100 text-blue-700',
  transcript: 'bg-green-100 text-green-700',
  summary: 'bg-purple-100 text-purple-700',
  action_item: 'bg-orange-100 text-orange-700',
};

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = terms.some(
      (term) => part.toLowerCase() === term.toLowerCase()
    );
    return isMatch ? (
      <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    );
  });
}

export function SearchResults({
  results,
  query,
  isLoading,
  total,
  took,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-slate-200 rounded" />
              <div className="h-5 bg-slate-200 rounded w-1/3" />
            </div>
            <div className="h-4 bg-slate-200 rounded w-full mb-2" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No results found
        </h3>
        <p className="text-slate-500">
          Try different keywords or adjust your filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results header */}
      {total !== undefined && took !== undefined && (
        <p className="text-sm text-slate-500">
          Found {total.toLocaleString()} results in {took}ms
        </p>
      )}

      {/* Results list */}
      {results.map((result) => {
        const Icon = typeIcons[result.type];
        const link =
          result.type === 'meeting'
            ? `/meetings/${result.meetingId}`
            : result.type === 'action_item'
              ? `/meetings/${result.meetingId}#action-items`
              : `/meetings/${result.meetingId}#${result.type}`;

        return (
          <Link
            key={`${result.type}-${result.id}`}
            href={link}
            className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-primary-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[result.type]}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${typeColors[result.type]}`}
                  >
                    {typeLabels[result.type]}
                  </span>
                  {result.meetingDate && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(result.meetingDate), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-slate-900 mb-1 line-clamp-1">
                  {highlightText(result.title, query)}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-2">
                  {highlightText(result.preview, query)}
                </p>

                {/* Highlights */}
                {result.highlights.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.highlights.slice(0, 2).map((highlight, i) => (
                      <p
                        key={i}
                        className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1 line-clamp-1"
                      >
                        ...{highlightText(highlight, query)}...
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 flex-shrink-0 mt-2" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
