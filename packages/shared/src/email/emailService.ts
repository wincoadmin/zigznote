/**
 * Email Service Implementation
 * Uses Resend as the primary email provider
 */

import type {
  EmailService,
  SendEmailOptions,
  EmailResult,
  EmailTemplate,
} from './types';
import * as templates from './templates';
import { createLogger } from '../logger';

const logger = createLogger({ module: 'email-service' });

/**
 * Template function mapping
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateFn = (data: any) => string;
const templateFunctions: Record<EmailTemplate, TemplateFn> = {
  'meeting-ready': templates.meetingReady,
  'transcription-complete': templates.meetingReady, // Same as meeting-ready
  'summary-ready': templates.meetingReady, // Same as meeting-ready
  'action-item-reminder': templates.actionItemReminder,
  'action-item-due': templates.actionItemReminder, // Same as reminder
  'meeting-shared': templates.meetingShared,
  'payment-failed': templates.paymentFailed,
  'payment-success': templates.welcome, // Basic success template
  'trial-ending': templates.trialEnding,
  'welcome': templates.welcome,
  'weekly-digest': templates.weeklyDigest,
};

/**
 * Resend Email Service Implementation
 */
class ResendEmailService implements EmailService {
  private apiKey: string | null;
  private fromAddress: string;
  private fromName: string;
  private baseUrl = 'https://api.resend.com';

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || null;
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'notifications@zigznote.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'zigznote';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.apiKey) {
      logger.warn('Email service not configured - RESEND_API_KEY missing');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const html = this.renderTemplate(options.template, options.data);
      const to = Array.isArray(options.to) ? options.to : [options.to];

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromAddress}>`,
          to,
          subject: options.subject,
          html,
          reply_to: options.replyTo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json() as { id: string };

      logger.info({ template: options.template, to, messageId: result.id }, 'Email sent successfully');

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ template: options.template, to: options.to, error: errorMessage }, 'Failed to send email');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendBatch(emails: SendEmailOptions[]): Promise<EmailResult[]> {
    // Resend has batch support, but for simplicity we'll send sequentially
    // Can be optimized later with their batch API
    const results: EmailResult[] = [];

    for (const email of emails) {
      const result = await this.send(email);
      results.push(result);

      // Small delay to avoid rate limiting
      if (emails.length > 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private renderTemplate(
    template: EmailTemplate,
    data: Record<string, unknown>
  ): string {
    const templateFn = templateFunctions[template];
    if (!templateFn) {
      throw new Error(`Unknown email template: ${template}`);
    }
    return templateFn(data);
  }
}

/**
 * Mock Email Service for testing/development
 */
class MockEmailService implements EmailService {
  private sentEmails: SendEmailOptions[] = [];

  isAvailable(): boolean {
    return true;
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    this.sentEmails.push(options);

    logger.info({ template: options.template, to: options.to, subject: options.subject }, 'Mock email sent');

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }

  async sendBatch(emails: SendEmailOptions[]): Promise<EmailResult[]> {
    return Promise.all(emails.map((email) => this.send(email)));
  }

  // Test helper methods
  getSentEmails(): SendEmailOptions[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}

/**
 * Create email service instance based on environment
 */
export function createEmailService(): EmailService {
  if (process.env.NODE_ENV === 'test') {
    return new MockEmailService();
  }

  return new ResendEmailService();
}

/**
 * Singleton email service instance
 */
export const emailService = createEmailService();
