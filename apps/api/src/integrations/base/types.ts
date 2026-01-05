/**
 * Integration Base Types
 * Shared types for all integrations
 */

export type IntegrationProvider = 'slack' | 'hubspot' | 'salesforce' | 'notion' | 'linear';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  tokenExpires?: Date;
  [key: string]: unknown;
}

export interface IntegrationSettings {
  enabled?: boolean;
  autoSend?: boolean;
  channels?: string[];
  [key: string]: unknown;
}

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  credentials: IntegrationCredentials;
  settings: IntegrationSettings;
  status: IntegrationStatus;
  connectedAt: Date;
  updatedAt: Date;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface IntegrationEvent {
  type: string;
  meetingId?: string;
  organizationId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface IntegrationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requiresReconfiguration?: boolean;
}

export interface MeetingSummaryPayload {
  meetingId: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  participants: Array<{ name: string; email?: string }>;
  summary: {
    executiveSummary: string;
    topics: Array<{ title: string; summary: string }>;
    decisions: string[];
  };
  actionItems: Array<{
    text: string;
    assignee?: string;
    dueDate?: string;
  }>;
  transcriptUrl?: string;
  recordingUrl?: string;
}
