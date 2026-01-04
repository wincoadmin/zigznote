/**
 * Shared constants used across the monorepo
 */

// ============================================
// Meeting Status
// ============================================

export const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const MEETING_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  recording: 'Recording',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

// ============================================
// Meeting Platforms
// ============================================

export const MEETING_PLATFORMS = {
  ZOOM: 'zoom',
  MEET: 'meet',
  TEAMS: 'teams',
  WEBEX: 'webex',
  OTHER: 'other',
} as const;

export const MEETING_PLATFORM_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  meet: 'Google Meet',
  teams: 'Microsoft Teams',
  webex: 'Webex',
  other: 'Other',
};

// ============================================
// User Roles
// ============================================

export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

// ============================================
// Organization Plans
// ============================================

export const ORGANIZATION_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const PLAN_LIMITS = {
  free: {
    meetingsPerMonth: 10,
    maxRecordingMinutes: 60,
    retentionDays: 30,
    customInsights: false,
    teamMembers: 1,
  },
  pro: {
    meetingsPerMonth: -1, // Unlimited
    maxRecordingMinutes: -1,
    retentionDays: 365,
    customInsights: true,
    teamMembers: 10,
  },
  enterprise: {
    meetingsPerMonth: -1,
    maxRecordingMinutes: -1,
    retentionDays: -1, // Custom
    customInsights: true,
    teamMembers: -1,
  },
} as const;

// ============================================
// Integration Providers
// ============================================

export const INTEGRATION_PROVIDERS = {
  SLACK: 'slack',
  HUBSPOT: 'hubspot',
  SALESFORCE: 'salesforce',
  NOTION: 'notion',
  LINEAR: 'linear',
  ZAPIER: 'zapier',
} as const;

// ============================================
// Event Types
// ============================================

export const EVENT_TYPES = {
  MEETING_SCHEDULED: 'meeting.scheduled',
  MEETING_STARTED: 'meeting.started',
  MEETING_ENDED: 'meeting.ended',
  MEETING_COMPLETED: 'meeting.completed',
  MEETING_FAILED: 'meeting.failed',
  TRANSCRIPT_READY: 'transcript.ready',
  SUMMARY_READY: 'summary.ready',
  ACTION_ITEMS_EXTRACTED: 'action_items.extracted',
} as const;

// ============================================
// API Constants
// ============================================

export const API_VERSION = 'v1';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const RATE_LIMITS = {
  general: { windowMs: 60000, max: 100 }, // 100 requests per minute
  auth: { windowMs: 60000, max: 10 }, // 10 auth attempts per minute
  upload: { windowMs: 60000, max: 10 }, // 10 uploads per minute
} as const;

// ============================================
// AI Model Constants
// ============================================

export const AI_MODELS = {
  CLAUDE_SONNET: 'claude-3-5-sonnet-20241022',
  GPT_4O_MINI: 'gpt-4o-mini',
  DEEPGRAM_NOVA_3: 'nova-3',
} as const;

export const DEFAULT_SUMMARIZATION_MODEL = AI_MODELS.CLAUDE_SONNET;
export const DEFAULT_TRANSCRIPTION_MODEL = AI_MODELS.DEEPGRAM_NOVA_3;

// ============================================
// Supported Languages
// ============================================

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
] as const;

export const DEFAULT_LANGUAGE = 'en';
