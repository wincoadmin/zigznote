/**
 * Database-related types and interfaces
 */

import { Prisma } from '@prisma/client';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated result with metadata
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

/**
 * Sort options
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Base filter options that all repositories share
 */
export interface BaseFilterOptions {
  includeDeleted?: boolean;
}

/**
 * Meeting filter options
 */
export interface MeetingFilterOptions extends BaseFilterOptions {
  organizationId?: string;
  createdById?: string;
  status?: string | string[];
  platform?: string;
  startTimeFrom?: Date;
  startTimeTo?: Date;
  search?: string;
  calendarEventId?: string;
}

/**
 * User filter options
 */
export interface UserFilterOptions extends BaseFilterOptions {
  organizationId?: string;
  role?: string;
  email?: string;
  search?: string;
}

/**
 * Transcript search options
 */
export interface TranscriptSearchOptions {
  query: string;
  organizationId?: string;
  meetingId?: string;
  language?: string;
  limit?: number;
}

/**
 * Search result with relevance score
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: string[];
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (
  tx: Prisma.TransactionClient
) => Promise<T>;

/**
 * Create meeting input
 */
export interface CreateMeetingInput {
  organizationId: string;
  createdById?: string;
  title: string;
  platform?: string;
  meetingUrl?: string;
  startTime?: Date;
  endTime?: Date;
  calendarEventId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Update meeting input
 */
export interface UpdateMeetingInput {
  title?: string;
  platform?: string;
  meetingUrl?: string;
  recordingUrl?: string;
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
  status?: string;
  botId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Create user input
 */
export interface CreateUserInput {
  organizationId: string;
  email: string;
  name?: string;
  clerkId?: string;
  role?: string;
  avatarUrl?: string;
}

/**
 * Update user input
 */
export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
  organizationId?: string;
}

/**
 * Create organization input
 */
export interface CreateOrganizationInput {
  name: string;
  plan?: string;
  settings?: Prisma.InputJsonValue;
}

/**
 * Update organization input
 */
export interface UpdateOrganizationInput {
  name?: string;
  plan?: string;
  settings?: Prisma.InputJsonValue;
}

/**
 * Create transcript input
 */
export interface CreateTranscriptInput {
  meetingId: string;
  segments: Prisma.InputJsonValue;
  fullText: string;
  wordCount: number;
  language?: string;
}

/**
 * Create summary input
 */
export interface CreateSummaryInput {
  meetingId: string;
  content: Prisma.InputJsonValue;
  modelUsed: string;
  promptVersion?: string;
}

/**
 * Create action item input
 */
export interface CreateActionItemInput {
  meetingId: string;
  text: string;
  assignee?: string;
  dueDate?: Date;
}

/**
 * Create user API key input
 */
export interface CreateUserApiKeyInput {
  userId: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date | null;
}

/**
 * Update user API key input
 */
export interface UpdateUserApiKeyInput {
  name?: string;
  scopes?: string[];
}
