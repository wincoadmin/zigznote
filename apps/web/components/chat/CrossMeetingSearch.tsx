'use client';

/**
 * Cross-Meeting Search Component
 * Semantic search across all meeting transcripts
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  FileText,
  Clock,
  Users,
  ChevronRight,
  Sparkles,
  X,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SearchResult {
  meetingId: string;
  meetingTitle: string;
  text: string;
  startTime: number;
  speakers: string[];
  similarity: number;
}

interface CrossMeetingSearchProps {
  onSearch: (query: string, meetingIds?: string[]) => Promise<SearchResult[]>;
  availableMeetings?: Array<{ id: string; title: string }>;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatRelevance(similarity: number): string {
  return `${Math.round(similarity * 100)}%`;
}

const resultVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 },
};

export function CrossMeetingSearch({
  onSearch,
  availableMeetings = [],
  className,
}: CrossMeetingSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await onSearch(
        query.trim(),
        selectedMeetings.length > 0 ? selectedMeetings : undefined
      );
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedMeetings, onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch();
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      handleSearch();
    }
  };

  const toggleMeetingFilter = (meetingId: string) => {
    setSelectedMeetings((prev) =>
      prev.includes(meetingId)
        ? prev.filter((id) => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const clearFilters = () => {
    setSelectedMeetings([]);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Search All Meetings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find anything across your meeting history
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search for decisions, action items, topics..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-20 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-purple-500"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
            {query && (
              <button
                onClick={clearSearch}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {availableMeetings.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'rounded p-1.5 transition-colors',
                  showFilters || selectedMeetings.length > 0
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                    : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Filter className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Meeting Filters */}
        <AnimatePresence>
          {showFilters && availableMeetings.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Filter by meeting:
                </span>
                {selectedMeetings.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {availableMeetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => toggleMeetingFilter(meeting.id)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs transition-colors',
                      selectedMeetings.includes(meeting.id)
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    )}
                  >
                    {meeting.title}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-purple-500" />
            <p className="text-gray-500 dark:text-gray-400">
              Searching your meetings...
            </p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Found {results.length} relevant result{results.length > 1 ? 's' : ''}
            </p>
            <AnimatePresence>
              {results.map((result, index) => (
                <motion.div
                  key={`${result.meetingId}-${result.startTime}-${index}`}
                  variants={resultVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={`/meetings/${result.meetingId}?t=${Math.floor(result.startTime)}`}
                    className="block rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-700 dark:hover:bg-purple-900/20"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {result.meetingTitle}
                        </span>
                      </div>
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        {formatRelevance(result.similarity)} match
                      </span>
                    </div>

                    <p className="mb-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                      {result.text}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(result.startTime)}
                      </span>
                      {result.speakers.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {result.speakers.join(', ')}
                        </span>
                      )}
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
              No results found
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try different keywords or broaden your search
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-purple-100 p-4 dark:bg-purple-900/40">
              <Search className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Search across all meetings
            </h4>
            <p className="mb-6 max-w-sm text-gray-500 dark:text-gray-400">
              Find decisions, action items, discussions, and more using semantic
              search.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'What decisions were made about pricing?',
                'Action items from last week',
                'Discussions about the product roadmap',
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrossMeetingSearch;
