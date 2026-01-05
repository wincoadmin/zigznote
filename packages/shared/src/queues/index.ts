/**
 * BullMQ queue definitions
 * Shared between API and worker services
 */

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  SUMMARIZATION: 'summarization',
  WEBHOOK: 'webhook',
  CALENDAR_SYNC: 'calendar-sync',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job types for each queue
 */
export const JOB_TYPES = {
  // Transcription queue
  TRANSCRIPTION: {
    PROCESS: 'transcription.process',
    DIARIZE: 'transcription.diarize',
  },
  // Summarization queue
  SUMMARIZATION: {
    GENERATE: 'summary.generate',
    EXTRACT_ACTION_ITEMS: 'summary.extractActionItems',
    CUSTOM_INSIGHTS: 'summary.customInsights',
  },
  // Webhook queue
  WEBHOOK: {
    DELIVER: 'webhook.deliver',
    RETRY: 'webhook.retry',
  },
  // Calendar sync queue
  CALENDAR_SYNC: {
    SYNC_USER: 'calendar.syncUser',
    SYNC_ORGANIZATION: 'calendar.syncOrganization',
    PROCESS_EVENT: 'calendar.processEvent',
  },
  // Notifications queue
  NOTIFICATIONS: {
    EMAIL: 'notification.email',
    SLACK: 'notification.slack',
    IN_APP: 'notification.inApp',
  },
} as const;

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days
  },
};

/**
 * Job priority levels
 */
export const JOB_PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

/**
 * Job data types
 */
export interface TranscriptionJobData {
  meetingId: string;
  audioUrl: string;
  language?: string;
  organizationId?: string;
  source?: 'bot' | 'upload' | 'browser' | 'mobile';
  /** Recall.ai bot ID (only for bot source) */
  recallBotId?: string;
}

export interface SummarizationJobData {
  meetingId: string;
  transcriptId: string;
  promptVersion?: string;
  customPrompt?: string;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

export interface CalendarSyncJobData {
  /** Type of sync operation */
  syncType: 'single' | 'user' | 'all';
  /** Calendar connection ID (for single sync) */
  connectionId?: string;
  /** User ID (for user sync) */
  userId?: string;
  /** Organization ID for meeting creation */
  organizationId?: string;
  /** Date range for sync */
  syncFrom?: Date;
  syncTo?: Date;
}

export interface NotificationJobData {
  type: 'email' | 'slack' | 'in_app';
  recipient: string;
  template: string;
  data: Record<string, unknown>;
}

/**
 * Job result types
 */
export interface TranscriptionJobResult {
  transcriptId: string;
  wordCount: number;
  durationMs: number;
}

export interface SummarizationJobResult {
  summaryId: string;
  actionItemCount: number;
  tokensUsed: number;
}

export interface WebhookJobResult {
  delivered: boolean;
  statusCode?: number;
  responseTime?: number;
}
