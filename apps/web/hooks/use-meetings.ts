'use client';

import { useState, useEffect, useCallback } from 'react';
import { meetingsApi } from '@/lib/api';

export interface Meeting {
  id: string;
  title: string;
  platform?: string;
  meetingUrl?: string;
  startTime?: string;
  endTime?: string;
  status: 'scheduled' | 'recording' | 'processing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface UseMeetingsOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export interface UseMeetingsResult {
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing meetings list
 */
export function useMeetings(options: UseMeetingsOptions = {}): UseMeetingsResult {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<UseMeetingsResult['pagination']>(null);

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await meetingsApi.list(options);

      if (response.success && response.data) {
        setMeetings(response.data as Meeting[]);
        setPagination(response.pagination || null);
      } else {
        setError(response.error?.message || 'Failed to fetch meetings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  return {
    meetings,
    isLoading,
    error,
    pagination,
    refetch: fetchMeetings,
  };
}
