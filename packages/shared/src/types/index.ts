/**
 * Shared TypeScript types used across the monorepo
 */

// ============================================
// User and Organization Types
// ============================================

export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettings {
  timezone?: string;
  defaultLanguage?: string;
  botName?: string;
  autoJoinMeetings?: boolean;
  retentionDays?: number;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  clerkId: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'member';

// ============================================
// Meeting Types
// ============================================

export interface Meeting {
  id: string;
  organizationId: string;
  createdById: string | null;
  title: string;
  platform: MeetingPlatform | null;
  meetingUrl: string | null;
  recordingUrl: string | null;
  startTime: Date | null;
  endTime: Date | null;
  durationSeconds: number | null;
  status: MeetingStatus;
  botId: string | null;
  calendarEventId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type MeetingPlatform = 'zoom' | 'meet' | 'teams' | 'webex' | 'other';

export type MeetingStatus =
  | 'scheduled'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'failed';

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  name: string;
  email: string | null;
  speakerLabel: string | null;
  isHost: boolean;
}

// ============================================
// Transcript Types
// ============================================

export interface Transcript {
  id: string;
  meetingId: string;
  segments: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

// ============================================
// Summary Types
// ============================================

export interface Summary {
  id: string;
  meetingId: string;
  content: SummaryContent;
  modelUsed: string;
  promptVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryContent {
  executiveSummary: string;
  topics: SummaryTopic[];
  decisions: string[];
  questions: string[];
  keyTakeaways?: string[];
}

export interface SummaryTopic {
  title: string;
  summary: string;
  startMs?: number;
  endMs?: number;
}

// ============================================
// Action Item Types
// ============================================

export interface ActionItem {
  id: string;
  meetingId: string;
  text: string;
  assignee: string | null;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Integration Types
// ============================================

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  settings: Record<string, unknown>;
  connectedAt: Date;
  updatedAt: Date;
}

export type IntegrationProvider =
  | 'slack'
  | 'hubspot'
  | 'salesforce'
  | 'notion'
  | 'linear'
  | 'zapier';

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Event Types (for webhooks and jobs)
// ============================================

export type EventType =
  | 'meeting.scheduled'
  | 'meeting.started'
  | 'meeting.ended'
  | 'meeting.completed'
  | 'meeting.failed'
  | 'transcript.ready'
  | 'summary.ready'
  | 'action_items.extracted';

export interface WebhookEvent<T = unknown> {
  id: string;
  type: EventType;
  timestamp: string;
  data: T;
}
