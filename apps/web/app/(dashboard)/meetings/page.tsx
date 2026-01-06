'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetingList } from '@/components/meetings';
import { useToast } from '@/components/ui/toast';
import { meetingsApi } from '@/lib/api';
import type { Meeting } from '@/types';

interface MeetingFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

export default function MeetingsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [filters, setFilters] = useState<MeetingFilters>({
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', filters],
    queryFn: async () => {
      const response = await meetingsApi.list(filters);
      if (response.success && response.data) {
        return {
          meetings: response.data as Meeting[],
          pagination: response.pagination,
        };
      }
      return { meetings: [], pagination: undefined };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      addToast({
        type: 'success',
        title: 'Meeting deleted',
        description: 'The meeting has been deleted successfully.',
      });
    },
    onError: () => {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to delete meeting. Please try again.',
      });
    },
  });

  const handleSearch = (query: string) => {
    setFilters((prev) => ({ ...prev, search: query || undefined, page: 1 }));
  };

  const handleFilterChange = (newFilters: { status?: string }) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Meetings
          </h1>
          <p className="text-slate-500">
            View and manage all your recorded meetings
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">
            <Plus className="mr-2 h-4 w-4" />
            New Meeting
          </Link>
        </Button>
      </div>

      {/* Meeting list */}
      <MeetingList
        meetings={data?.meetings}
        isLoading={isLoading}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {filters.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= data.pagination.totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
