'use client';

import { useState, useCallback } from 'react';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults, SearchResult } from '@/components/search/SearchResults';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Filter,
  Calendar,
  Video,
  FileText,
  ListChecks,
  ClipboardList,
  Sparkles,
} from 'lucide-react';

type SearchType = 'meeting' | 'transcript' | 'summary' | 'action_item';

interface SearchFilters {
  types: SearchType[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [took, setTook] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    types: ['meeting', 'transcript', 'summary', 'action_item'],
  });

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      setQuery(searchQuery);
      setIsLoading(true);
      setHasSearched(true);

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          types: filters.types.join(','),
          limit: '50',
        });

        if (filters.dateRange?.start) {
          params.set('startDate', filters.dateRange.start);
        }
        if (filters.dateRange?.end) {
          params.set('endDate', filters.dateRange.end);
        }

        const response = await fetch(`/api/v1/search?${params}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.data || []);
          setTotal(data.meta?.total || 0);
          setTook(data.meta?.took || 0);
        } else {
          setResults([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filters]
  );

  const handleSuggestions = useCallback(async (prefix: string) => {
    try {
      const response = await fetch(
        `/api/v1/search/suggestions?q=${encodeURIComponent(prefix)}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      console.error('Suggestions failed:', error);
    }
    return [];
  }, []);

  const toggleType = (type: SearchType) => {
    setFilters((prev) => {
      const types = prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type];
      return { ...prev, types: types.length > 0 ? types : [type] };
    });
  };

  const typeButtons: Array<{ type: SearchType; icon: React.ElementType; label: string }> = [
    { type: 'meeting', icon: Video, label: 'Meetings' },
    { type: 'transcript', icon: FileText, label: 'Transcripts' },
    { type: 'summary', icon: ClipboardList, label: 'Summaries' },
    { type: 'action_item', icon: ListChecks, label: 'Action Items' },
  ];

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">
          Search Your Meetings
        </h1>
        <p className="text-slate-500">
          Find anything across all your meetings, transcripts, and summaries
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          onSearch={handleSearch}
          onSuggestionsRequest={handleSuggestions}
          placeholder="Search meetings, transcripts, summaries..."
          autoFocus
          className="max-w-2xl mx-auto"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>

          {/* Quick type filters */}
          <div className="flex gap-2">
            {typeButtons.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                variant={filters.types.includes(type) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleType(type)}
                className="gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Date Range</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, dateRange: undefined }))
                  }
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results */}
      {hasSearched ? (
        <SearchResults
          results={results}
          query={query}
          isLoading={isLoading}
          total={total}
          took={took}
        />
      ) : (
        /* Initial state with tips */
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Search Tips
          </h3>
          <div className="max-w-md mx-auto text-left space-y-3 text-sm text-slate-600">
            <p>
              <Badge variant="outline" className="mr-2">
                Keywords
              </Badge>
              Search for specific topics like "budget review" or "Q4 planning"
            </p>
            <p>
              <Badge variant="outline" className="mr-2">
                Names
              </Badge>
              Find mentions of people like "John mentioned"
            </p>
            <p>
              <Badge variant="outline" className="mr-2">
                Actions
              </Badge>
              Look for action items like "follow up" or "send email"
            </p>
            <p>
              <Badge variant="outline" className="mr-2">
                Decisions
              </Badge>
              Find decisions like "we decided" or "agreed to"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
