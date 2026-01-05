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
  // Audio source tracking
  source?: 'bot' | 'upload' | 'browser' | 'mobile';
  status?: string;
  audioFileUrl?: string;
  audioFileName?: string;
  audioFileSize?: number;
  audioDuration?: number;
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

/**
 * Create speaker alias input
 */
export interface CreateSpeakerAliasInput {
  organizationId: string;
  speakerLabel: string;
  displayName: string;
  email?: string | null;
  meetingId?: string | null;
  confidence?: number;
}

/**
 * Update speaker alias input
 */
export interface UpdateSpeakerAliasInput {
  displayName?: string;
  email?: string | null;
  confidence?: number;
}

/**
 * Create custom vocabulary input
 */
export interface CreateCustomVocabularyInput {
  organizationId: string;
  term: string;
  boost?: number;
  category?: string | null;
}

/**
 * Update custom vocabulary input
 */
export interface UpdateCustomVocabularyInput {
  term?: string;
  boost?: number;
  category?: string | null;
}

// ============================================
// Admin Panel Types
// ============================================

/**
 * Admin user roles with hierarchy
 */
export type AdminRole = 'super_admin' | 'admin' | 'support' | 'viewer';

/**
 * Account types for organizations
 */
export type AccountType = 'REGULAR' | 'TRIAL' | 'COMPLIMENTARY' | 'PARTNER' | 'INTERNAL';

/**
 * Create admin user input
 */
export interface CreateAdminUserInput {
  email: string;
  passwordHash: string;
  name: string;
  role?: AdminRole;
  createdBy?: string;
}

/**
 * Update admin user input
 */
export interface UpdateAdminUserInput {
  email?: string;
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
  twoFactorSecret?: string | null;
  twoFactorEnabled?: boolean;
  backupCodes?: string[];
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  passwordHash?: string;
  passwordChangedAt?: Date;
}

/**
 * Create admin session input
 */
export interface CreateAdminSessionInput {
  adminUserId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

/**
 * Create audit log input
 */
export interface CreateAuditLogInput {
  adminUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
  previousData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
  ipAddress: string;
  userAgent?: string | null;
}

/**
 * Audit log filter options
 */
export interface AuditLogFilterOptions {
  adminUserId?: string;
  action?: string | string[];
  entityType?: string | string[];
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Create system API key input
 */
export interface CreateSystemApiKeyInput {
  name: string;
  provider: string;
  environment?: string;
  encryptedKey: string;
  keyHint: string;
  expiresAt?: Date | null;
  rotationDue?: Date | null;
  createdBy?: string;
}

/**
 * Update system API key input
 */
export interface UpdateSystemApiKeyInput {
  name?: string;
  encryptedKey?: string;
  keyHint?: string;
  isActive?: boolean;
  expiresAt?: Date | null;
  rotatedAt?: Date;
  rotationDue?: Date | null;
  lastUsedAt?: Date;
  usageCount?: number;
}

/**
 * Create feature flag input
 */
export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  percentage?: number;
  targetRules?: Prisma.InputJsonValue;
  category?: string;
  createdBy?: string;
}

/**
 * Update feature flag input
 */
export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  percentage?: number;
  targetRules?: Prisma.InputJsonValue;
  category?: string;
}

/**
 * Create system config input
 */
export interface CreateSystemConfigInput {
  key: string;
  value: Prisma.InputJsonValue;
  encrypted?: boolean;
  category?: string;
  updatedBy?: string;
}

/**
 * Update system config input
 */
export interface UpdateSystemConfigInput {
  value?: Prisma.InputJsonValue;
  encrypted?: boolean;
  category?: string;
  updatedBy?: string;
}

/**
 * Update organization billing override input
 */
export interface UpdateOrganizationBillingOverrideInput {
  accountType?: AccountType;
  billingOverrideReason?: string | null;
  billingOverrideBy?: string;
  billingOverrideAt?: Date;
  accountNotes?: string | null;
}
