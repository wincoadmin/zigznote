/**
 * Webhook Types
 */

export type WebhookEvent =
  | 'meeting.started'
  | 'meeting.ended'
  | 'meeting.updated'
  | 'meeting.deleted'
  | 'transcript.ready'
  | 'summary.ready'
  | 'action_items.ready'
  | 'bot.joined'
  | 'bot.left'
  | 'bot.error';

export type WebhookStatus = 'active' | 'inactive' | 'failed';

export interface WebhookConfig {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: Date;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  headers?: Record<string, string>;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  headers?: Record<string, string>;
  status?: WebhookStatus;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  duration: number;
}

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'meeting.started',
  'meeting.ended',
  'meeting.updated',
  'meeting.deleted',
  'transcript.ready',
  'summary.ready',
  'action_items.ready',
  'bot.joined',
  'bot.left',
  'bot.error',
];

export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_DELAYS = [
  1000,      // 1 second
  5000,      // 5 seconds
  30000,     // 30 seconds
  300000,    // 5 minutes
  3600000,   // 1 hour
];
