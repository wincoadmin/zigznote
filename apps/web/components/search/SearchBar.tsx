'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSuggestionsRequest?: (query: string) => Promise<string[]>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  onSearch,
  onSuggestionsRequest,
  placeholder = 'Search meetings, transcripts, summaries...',
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (!onSuggestionsRequest || debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await onSuggestionsRequest(debouncedQuery);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        setSuggestions([]);
      }
    }

    fetchSuggestions();
  }, [debouncedQuery, onSuggestionsRequest]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
        setShowSuggestions(false);
      }
    },
    [query, onSearch]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      onSearch(suggestion);
      setShowSuggestions(false);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    []
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 sm:left-3 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-2.5 text-sm sm:text-base text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {isLoading ? (
            <Loader2 className="absolute right-2.5 sm:right-3 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 sm:right-3 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : null}
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-left text-sm sm:text-base text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
