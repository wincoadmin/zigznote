'use client';

import { useState } from 'react';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { MeetingCard } from './MeetingCard';
import type { Meeting } from '@/types';

interface MeetingListProps {
  meetings?: Meeting[];
  isLoading?: boolean;
  onDelete?: (id: string) => void;
  onSearch?: (query: string) => void;
  onFilterChange?: (filters: { status?: string; dateRange?: string }) => void;
  onSortChange?: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}

export function MeetingList({
  meetings,
  isLoading,
  onDelete,
  onSearch,
  onFilterChange,
  onSortChange,
}: MeetingListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    onFilterChange?.({ status: value === 'all' ? undefined : value });
  };

  const handleSortToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    onSortChange?.({ field: 'startTime', direction: newDirection });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search meetings..."
              className="pl-9"
              value={searchQuery}
              onChange={() => {}}
              disabled
            />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search meetings..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="search-input"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-36"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="recording">Recording</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSortToggle}
            aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortDirection === 'asc' ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Meeting list */}
      {!meetings || meetings.length === 0 ? (
        <EmptyState
          title="No meetings found"
          description={
            searchQuery
              ? 'Try adjusting your search or filters'
              : 'Your meetings will appear here once you start recording'
          }
        />
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
