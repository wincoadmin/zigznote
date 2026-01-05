/**
 * Email service types and interfaces
 */

export type EmailTemplate =
  | 'meeting-ready'
  | 'transcription-complete'
  | 'summary-ready'
  | 'action-item-reminder'
  | 'action-item-due'
  | 'meeting-shared'
  | 'payment-failed'
  | 'payment-success'
  | 'trial-ending'
  | 'welcome'
  | 'weekly-digest';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailService {
  send(options: SendEmailOptions): Promise<EmailResult>;
  sendBatch(emails: SendEmailOptions[]): Promise<EmailResult[]>;
  isAvailable(): boolean;
}

export interface MeetingReadyData {
  userName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingUrl: string;
  unsubscribeUrl: string;
}

export interface ActionItemReminderData {
  userName: string;
  actionItem: string;
  dueDate: string;
  meetingTitle: string;
  meetingUrl: string;
  unsubscribeUrl: string;
}

export interface PaymentFailedData {
  userName: string;
  planName: string;
  amount: string;
  nextRetryDate: string;
  updatePaymentUrl: string;
}

export interface MeetingSharedData {
  recipientName?: string;
  senderName: string;
  meetingTitle: string;
  meetingDate: string;
  message?: string;
  shareUrl: string;
  expiresAt?: string;
}

export interface WeeklyDigestData {
  userName: string;
  weekStart: string;
  weekEnd: string;
  meetingsCount: number;
  actionItemsCount: number;
  completedCount: number;
  topMeetings: Array<{
    title: string;
    date: string;
    url: string;
  }>;
  pendingActionItems: Array<{
    text: string;
    dueDate?: string;
    meetingTitle: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export interface WelcomeEmailData {
  userName: string;
  loginUrl: string;
  guideUrl: string;
}

export interface TrialEndingData {
  userName: string;
  daysRemaining: number;
  trialEndDate: string;
  upgradeUrl: string;
  featuresIncluded: string[];
}
