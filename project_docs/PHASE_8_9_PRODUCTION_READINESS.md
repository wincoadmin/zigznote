# Phase 8.9: Production Readiness

## Overview

This phase addresses critical gaps identified during the production readiness audit. These are **must-have features** before public launch to ensure legal compliance, user expectations, and revenue protection.

**Estimated Time:** 4-6 hours
**Priority:** P0 - Launch Blocker

---

## Table of Contents

1. [Email Notification System](#1-email-notification-system)
2. [Recording Consent Management](#2-recording-consent-management)
3. [GDPR Data Export](#3-gdpr-data-export)
4. [Usage Quota Enforcement](#4-usage-quota-enforcement)
5. [Meeting Export (PDF/DOCX/SRT)](#5-meeting-export)
6. [Meeting Sharing](#6-meeting-sharing)
7. [Transcript Editing](#7-transcript-editing)
8. [Database Schema Changes](#8-database-schema-changes)
9. [API Routes Summary](#9-api-routes-summary)
10. [Frontend Components](#10-frontend-components)
11. [Testing Requirements](#11-testing-requirements)

---

## 1. Email Notification System

### 1.1 Overview

Implement transactional email service for critical user notifications.

### 1.2 Email Provider Setup

**Recommended Provider:** Resend (modern, developer-friendly, good free tier)
**Alternative:** SendGrid, Postmark, AWS SES

```typescript
// packages/shared/src/email/emailService.ts

import { Resend } from 'resend';

export interface EmailService {
  send(options: SendEmailOptions): Promise<EmailResult>;
  sendBatch(emails: SendEmailOptions[]): Promise<EmailResult[]>;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  replyTo?: string;
}

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

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class ResendEmailService implements EmailService {
  private client: Resend;
  private fromAddress: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }
    this.client = new Resend(apiKey);
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'notifications@zigznote.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'zigznote';
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    try {
      const html = await this.renderTemplate(options.template, options.data);
      
      const result = await this.client.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html,
        replyTo: options.replyTo,
      });

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatch(emails: SendEmailOptions[]): Promise<EmailResult[]> {
    return Promise.all(emails.map((email) => this.send(email)));
  }

  private async renderTemplate(
    template: EmailTemplate,
    data: Record<string, unknown>
  ): Promise<string> {
    // Use React Email or simple template strings
    const templates = await import('./templates');
    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Unknown email template: ${template}`);
    }
    return templateFn(data);
  }
}

export const emailService = new ResendEmailService();
```

### 1.3 Email Templates

```typescript
// packages/shared/src/email/templates/index.ts

export function meetingReady(data: {
  userName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { 
            background: #6366f1; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            display: inline-block;
          }
          .footer { color: #64748b; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Your meeting is ready! 🎉</h2>
          <p>Hi ${data.userName},</p>
          <p>Great news! Your meeting "<strong>${data.meetingTitle}</strong>" from ${data.meetingDate} has been transcribed and summarized.</p>
          <p>
            <a href="${data.meetingUrl}" class="button">View Meeting</a>
          </p>
          <div class="footer">
            <p>You received this email because you recorded a meeting with zigznote.</p>
            <p><a href="{{unsubscribe_url}}">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function actionItemReminder(data: {
  userName: string;
  actionItem: string;
  dueDate: string;
  meetingTitle: string;
  meetingUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .action-item { 
            background: #f8fafc; 
            border-left: 4px solid #6366f1; 
            padding: 16px; 
            margin: 20px 0;
          }
          .button { 
            background: #6366f1; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Action Item Reminder ⏰</h2>
          <p>Hi ${data.userName},</p>
          <p>You have an action item due ${data.dueDate}:</p>
          <div class="action-item">
            <strong>${data.actionItem}</strong>
            <p style="color: #64748b; margin: 8px 0 0;">From: ${data.meetingTitle}</p>
          </div>
          <p>
            <a href="${data.meetingUrl}" class="button">View Meeting</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

export function paymentFailed(data: {
  userName: string;
  planName: string;
  amount: string;
  nextRetryDate: string;
  updatePaymentUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert { 
            background: #fef2f2; 
            border: 1px solid #fecaca; 
            border-radius: 8px;
            padding: 16px; 
            margin: 20px 0;
          }
          .button { 
            background: #6366f1; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Payment Failed</h2>
          <p>Hi ${data.userName},</p>
          <div class="alert">
            <p>We couldn't process your payment of <strong>${data.amount}</strong> for your ${data.planName} subscription.</p>
          </div>
          <p>We'll automatically retry on ${data.nextRetryDate}. To avoid any service interruption, please update your payment method:</p>
          <p>
            <a href="${data.updatePaymentUrl}" class="button">Update Payment Method</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

export function meetingShared(data: {
  recipientName: string;
  senderName: string;
  meetingTitle: string;
  meetingDate: string;
  message?: string;
  shareUrl: string;
  expiresAt?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .meeting-card { 
            background: #f8fafc; 
            border-radius: 8px;
            padding: 20px; 
            margin: 20px 0;
          }
          .message { 
            background: #eff6ff; 
            border-radius: 8px;
            padding: 16px; 
            margin: 20px 0;
            font-style: italic;
          }
          .button { 
            background: #6366f1; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${data.senderName} shared a meeting with you</h2>
          <p>Hi${data.recipientName ? ' ' + data.recipientName : ''},</p>
          <div class="meeting-card">
            <h3 style="margin: 0 0 8px;">${data.meetingTitle}</h3>
            <p style="color: #64748b; margin: 0;">${data.meetingDate}</p>
          </div>
          ${data.message ? `<div class="message">"${data.message}"</div>` : ''}
          <p>
            <a href="${data.shareUrl}" class="button">View Meeting</a>
          </p>
          ${data.expiresAt ? `<p style="color: #64748b; font-size: 14px;">This link expires on ${data.expiresAt}</p>` : ''}
        </div>
      </body>
    </html>
  `;
}

// Export all templates
export * from './weeklyDigest';
export * from './welcome';
export * from './trialEnding';
```

### 1.4 Notification Preferences Model

```prisma
// Add to schema.prisma

model NotificationPreferences {
  id             String   @id @default(uuid())
  userId         String   @unique @map("user_id")
  
  // Email notifications
  emailMeetingReady       Boolean @default(true) @map("email_meeting_ready")
  emailActionItemReminder Boolean @default(true) @map("email_action_item_reminder")
  emailWeeklyDigest       Boolean @default(true) @map("email_weekly_digest")
  emailMeetingShared      Boolean @default(true) @map("email_meeting_shared")
  emailPaymentAlerts      Boolean @default(true) @map("email_payment_alerts")
  
  // Reminder timing
  actionItemReminderDays  Int     @default(1) @map("action_item_reminder_days") // Days before due
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("notification_preferences")
}
```

### 1.5 Email Queue Worker

```typescript
// services/notifications/src/emailWorker.ts

import { Worker, Job } from 'bullmq';
import { emailService } from '@zigznote/shared';
import { prisma } from '@zigznote/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface EmailJobData {
  type: 'meeting-ready' | 'action-reminder' | 'payment-failed' | 'meeting-shared' | 'weekly-digest';
  userId?: string;
  to?: string; // For external shares
  data: Record<string, unknown>;
}

const emailWorker = new Worker<EmailJobData>(
  'emails',
  async (job: Job<EmailJobData>) => {
    const { type, userId, to, data } = job.data;
    
    // Check user preferences if userId provided
    if (userId) {
      const prefs = await prisma.notificationPreferences.findUnique({
        where: { userId },
      });
      
      // Check if this email type is enabled
      const prefMap: Record<string, keyof typeof prefs> = {
        'meeting-ready': 'emailMeetingReady',
        'action-reminder': 'emailActionItemReminder',
        'payment-failed': 'emailPaymentAlerts',
        'meeting-shared': 'emailMeetingShared',
        'weekly-digest': 'emailWeeklyDigest',
      };
      
      const prefKey = prefMap[type];
      if (prefs && prefKey && !prefs[prefKey]) {
        logger.info({ type, userId }, 'Email skipped - user disabled this notification');
        return { skipped: true, reason: 'user_preference' };
      }
      
      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      
      if (!user?.email) {
        throw new Error(`User ${userId} has no email`);
      }
      
      data.userName = user.name || 'there';
      to = user.email;
    }
    
    if (!to) {
      throw new Error('No recipient email');
    }
    
    const templateMap: Record<string, { template: string; subject: string }> = {
      'meeting-ready': {
        template: 'meetingReady',
        subject: `Your meeting "${data.meetingTitle}" is ready`,
      },
      'action-reminder': {
        template: 'actionItemReminder',
        subject: `Reminder: Action item due ${data.dueDate}`,
      },
      'payment-failed': {
        template: 'paymentFailed',
        subject: 'Action required: Payment failed',
      },
      'meeting-shared': {
        template: 'meetingShared',
        subject: `${data.senderName} shared a meeting with you`,
      },
      'weekly-digest': {
        template: 'weeklyDigest',
        subject: 'Your weekly meeting digest',
      },
    };
    
    const config = templateMap[type];
    if (!config) {
      throw new Error(`Unknown email type: ${type}`);
    }
    
    const result = await emailService.send({
      to,
      subject: config.subject,
      template: config.template as any,
      data,
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    logger.info({ type, to, messageId: result.messageId }, 'Email sent successfully');
    return result;
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 10,
  }
);

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Email job failed');
});

export { emailWorker };
```

### 1.6 Trigger Points

Add email triggers to existing services:

```typescript
// In summarization processor - after summary complete
import { emailQueue } from '@zigznote/shared';

// After saving summary
await emailQueue.add('meeting-ready', {
  type: 'meeting-ready',
  userId: meeting.userId,
  data: {
    meetingTitle: meeting.title,
    meetingDate: meeting.startTime?.toLocaleDateString(),
    meetingUrl: `${process.env.APP_URL}/meetings/${meeting.id}`,
  },
});

// In billing service - after payment failure
await emailQueue.add('payment-failed', {
  type: 'payment-failed',
  userId,
  data: {
    planName,
    amount: formatCurrency(amount),
    nextRetryDate: nextRetry.toLocaleDateString(),
    updatePaymentUrl: `${process.env.APP_URL}/settings/billing`,
  },
});
```

---

## 2. Recording Consent Management

### 2.1 Overview

Implement recording consent to protect users legally in two-party consent jurisdictions.

### 2.2 Database Schema

```prisma
// Add to schema.prisma

model OrganizationSettings {
  id             String   @id @default(uuid())
  organizationId String   @unique @map("organization_id")
  
  // Consent settings
  recordingConsentEnabled  Boolean @default(true) @map("recording_consent_enabled")
  consentAnnouncementText  String? @map("consent_announcement_text")
  requireExplicitConsent   Boolean @default(false) @map("require_explicit_consent")
  
  // Default bot behavior
  defaultBotName           String  @default("zigznote Notetaker") @map("default_bot_name")
  joinAnnouncementEnabled  Boolean @default(true) @map("join_announcement_enabled")
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("organization_settings")
}

// Add to Meeting model
model Meeting {
  // ... existing fields
  
  consentObtained    Boolean   @default(false) @map("consent_obtained")
  consentObtainedAt  DateTime? @map("consent_obtained_at")
  consentMethod      String?   @map("consent_method") // 'announcement' | 'explicit' | 'calendar_notice'
  
  // ... rest of model
}
```

### 2.3 Recall.ai Bot Configuration

```typescript
// apps/api/src/services/recallService.ts - Update createBot method

interface CreateBotOptions {
  meetingUrl: string;
  meetingId: string;
  organizationId: string;
  botName?: string;
  joinAnnouncement?: string;
}

async createBot(options: CreateBotOptions): Promise<RecallBot> {
  const { meetingUrl, meetingId, organizationId, botName, joinAnnouncement } = options;
  
  // Get organization settings
  const orgSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });
  
  const effectiveBotName = botName || orgSettings?.defaultBotName || 'zigznote Notetaker';
  
  // Build announcement message
  let announcement: string | undefined;
  if (orgSettings?.recordingConsentEnabled && orgSettings?.joinAnnouncementEnabled) {
    announcement = orgSettings.consentAnnouncementText || 
      `Hi everyone! I'm ${effectiveBotName}. This meeting will be recorded and transcribed. ` +
      `By staying in the meeting, you consent to being recorded. ` +
      `The recording will be available to the meeting organizer.`;
  }
  
  const response = await this.client.post('/api/v1/bot', {
    meeting_url: meetingUrl,
    bot_name: effectiveBotName,
    transcription_options: {
      provider: 'default',
    },
    chat: announcement ? {
      on_bot_join: {
        send_to: 'everyone',
        message: announcement,
      },
    } : undefined,
    recording_mode: 'speaker_view',
    automatic_leave: {
      waiting_room_timeout: 300,
      noone_joined_timeout: 300,
      everyone_left_timeout: 30,
    },
    metadata: {
      meeting_id: meetingId,
      organization_id: organizationId,
    },
  });
  
  // Update meeting with consent info
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      consentObtained: !!announcement,
      consentObtainedAt: announcement ? new Date() : null,
      consentMethod: announcement ? 'announcement' : null,
    },
  });
  
  return this.mapBotResponse(response.data);
}
```

### 2.4 Consent Settings API

```typescript
// apps/api/src/routes/organizationSettings.ts

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '@zigznote/database';

export const orgSettingsRouter = Router();

const updateConsentSettingsSchema = z.object({
  recordingConsentEnabled: z.boolean().optional(),
  consentAnnouncementText: z.string().max(500).optional(),
  requireExplicitConsent: z.boolean().optional(),
  defaultBotName: z.string().min(1).max(50).optional(),
  joinAnnouncementEnabled: z.boolean().optional(),
});

// GET /api/v1/organization/settings
orgSettingsRouter.get('/', requireAuth, async (req, res) => {
  const { organizationId } = req.auth!;
  
  let settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });
  
  // Create default settings if not exists
  if (!settings) {
    settings = await prisma.organizationSettings.create({
      data: { organizationId },
    });
  }
  
  res.json({ success: true, data: settings });
});

// PATCH /api/v1/organization/settings
orgSettingsRouter.patch('/', requireAuth, async (req, res) => {
  const { organizationId, role } = req.auth!;
  
  // Only admins can update settings
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Only organization admins can update settings' 
    });
  }
  
  const parsed = updateConsentSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error });
  }
  
  const settings = await prisma.organizationSettings.upsert({
    where: { organizationId },
    update: parsed.data,
    create: { organizationId, ...parsed.data },
  });
  
  res.json({ success: true, data: settings });
});
```

### 2.5 Consent Settings UI

```tsx
// apps/web/app/settings/recording/page.tsx

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Bot, MessageSquare, AlertTriangle } from 'lucide-react';

export default function RecordingSettingsPage() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['organization-settings'],
    queryFn: () => fetch('/api/v1/organization/settings').then(r => r.json()),
  });
  
  const updateSettings = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/v1/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
    },
  });
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  const data = settings?.data;
  
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Recording & Consent Settings</h1>
      
      {/* Legal Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Important Legal Notice</h3>
            <p className="text-sm text-amber-700 mt-1">
              Some jurisdictions require consent from all parties before recording. 
              We recommend keeping consent announcements enabled. This is not legal advice - 
              please consult with a legal professional for your specific situation.
            </p>
          </div>
        </div>
      </div>
      
      {/* Bot Settings */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Bot Settings</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bot Display Name</label>
            <input
              type="text"
              value={data?.defaultBotName || 'zigznote Notetaker'}
              onChange={(e) => updateSettings.mutate({ defaultBotName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="zigznote Notetaker"
            />
            <p className="text-xs text-slate-500 mt-1">
              This name appears in the meeting participant list
            </p>
          </div>
        </div>
      </div>
      
      {/* Consent Settings */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Recording Consent</h2>
        </div>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={data?.recordingConsentEnabled ?? true}
              onChange={(e) => updateSettings.mutate({ recordingConsentEnabled: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span>Enable recording consent workflow</span>
          </label>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={data?.joinAnnouncementEnabled ?? true}
              onChange={(e) => updateSettings.mutate({ joinAnnouncementEnabled: e.target.checked })}
              className="w-4 h-4 rounded"
              disabled={!data?.recordingConsentEnabled}
            />
            <span>Bot announces recording when joining</span>
          </label>
        </div>
      </div>
      
      {/* Announcement Message */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Announcement Message</h2>
        </div>
        
        <textarea
          value={data?.consentAnnouncementText || ''}
          onChange={(e) => updateSettings.mutate({ consentAnnouncementText: e.target.value })}
          placeholder="Hi everyone! This meeting will be recorded and transcribed..."
          className="w-full px-3 py-2 border rounded-lg h-32"
          disabled={!data?.recordingConsentEnabled || !data?.joinAnnouncementEnabled}
        />
        <p className="text-xs text-slate-500 mt-1">
          Leave blank to use the default message. Max 500 characters.
        </p>
      </div>
    </div>
  );
}
```

---

## 3. GDPR Data Export

### 3.1 Overview

Implement user data export to comply with GDPR Article 20 (Right to Data Portability).

### 3.2 Data Export Service

```typescript
// apps/api/src/services/dataExportService.ts

import { prisma } from '@zigznote/database';
import { storageService } from './storageService';
import archiver from 'archiver';
import { Readable } from 'stream';

interface ExportOptions {
  userId: string;
  organizationId: string;
  includeAudio?: boolean;
}

interface ExportResult {
  downloadUrl: string;
  expiresAt: Date;
  sizeBytes: number;
}

class DataExportService {
  /**
   * Generate a complete data export for a user
   */
  async generateExport(options: ExportOptions): Promise<ExportResult> {
    const { userId, organizationId, includeAudio = false } = options;
    
    // Fetch all user data
    const [user, meetings, actionItems, conversations, apiKeys] = await Promise.all([
      this.exportUserData(userId),
      this.exportMeetings(userId, organizationId, includeAudio),
      this.exportActionItems(userId, organizationId),
      this.exportConversations(userId),
      this.exportApiKeys(userId),
    ]);
    
    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk) => chunks.push(chunk));
    
    // Add JSON files
    archive.append(JSON.stringify(user, null, 2), { name: 'user-profile.json' });
    archive.append(JSON.stringify(meetings.metadata, null, 2), { name: 'meetings/index.json' });
    archive.append(JSON.stringify(actionItems, null, 2), { name: 'action-items.json' });
    archive.append(JSON.stringify(conversations, null, 2), { name: 'ai-conversations.json' });
    archive.append(JSON.stringify(apiKeys, null, 2), { name: 'api-keys.json' });
    
    // Add individual meeting files
    for (const meeting of meetings.details) {
      archive.append(
        JSON.stringify(meeting, null, 2), 
        { name: `meetings/${meeting.id}/meeting.json` }
      );
      
      if (meeting.transcript) {
        archive.append(meeting.transcript, { name: `meetings/${meeting.id}/transcript.txt` });
      }
      
      if (meeting.summary) {
        archive.append(meeting.summary, { name: `meetings/${meeting.id}/summary.md` });
      }
      
      // Include audio if requested
      if (includeAudio && meeting.audioUrl) {
        const audioStream = await storageService.getFileStream(meeting.audioUrl);
        archive.append(audioStream, { name: `meetings/${meeting.id}/audio.webm` });
      }
    }
    
    // Add README
    archive.append(this.generateReadme(), { name: 'README.txt' });
    
    await archive.finalize();
    
    const buffer = Buffer.concat(chunks);
    
    // Upload to storage with expiring URL
    const filename = `exports/${userId}/${Date.now()}-data-export.zip`;
    await storageService.uploadFile(filename, buffer, 'application/zip');
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const downloadUrl = await storageService.getSignedUrl(filename, expiresAt);
    
    return {
      downloadUrl,
      expiresAt,
      sizeBytes: buffer.length,
    };
  }
  
  private async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        notificationPreferences: true,
      },
    });
    
    return {
      ...user,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
    };
  }
  
  private async exportMeetings(userId: string, organizationId: string, includeAudio: boolean) {
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        userId,
        deletedAt: null,
      },
      include: {
        transcript: true,
        summary: true,
        participants: true,
        actionItems: true,
      },
      orderBy: { startTime: 'desc' },
    });
    
    const metadata = meetings.map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      endTime: m.endTime,
      duration: m.duration,
      platform: m.platform,
      participantCount: m.participants.length,
      hasTranscript: !!m.transcript,
      hasSummary: !!m.summary,
      actionItemCount: m.actionItems.length,
    }));
    
    const details = meetings.map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      endTime: m.endTime,
      duration: m.duration,
      platform: m.platform,
      meetingUrl: m.meetingUrl,
      participants: m.participants.map(p => ({ name: p.name, email: p.email })),
      transcript: m.transcript?.fullText || null,
      summary: m.summary ? this.formatSummaryAsMarkdown(m.summary.content) : null,
      actionItems: m.actionItems.map(a => ({
        title: a.title,
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        status: a.status,
        priority: a.priority,
      })),
      audioUrl: includeAudio ? m.audioFileUrl : undefined,
    }));
    
    return { metadata, details };
  }
  
  private async exportActionItems(userId: string, organizationId: string) {
    const actionItems = await prisma.actionItem.findMany({
      where: {
        meeting: { organizationId },
        OR: [
          { assigneeUserId: userId },
          { createdById: userId },
        ],
      },
      include: {
        meeting: { select: { id: true, title: true } },
      },
    });
    
    return actionItems.map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      assignee: a.assignee,
      dueDate: a.dueDate,
      status: a.status,
      priority: a.priority,
      meeting: { id: a.meeting.id, title: a.meeting.title },
      createdAt: a.createdAt,
    }));
  }
  
  private async exportConversations(userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        meeting: { select: { id: true, title: true } },
      },
    });
    
    return conversations.map(c => ({
      id: c.id,
      title: c.title,
      meeting: { id: c.meeting?.id, title: c.meeting?.title },
      messages: c.messages.map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      createdAt: c.createdAt,
    }));
  }
  
  private async exportApiKeys(userId: string) {
    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        // NOTE: We don't export the actual key hash for security
      },
    });
    
    return apiKeys;
  }
  
  private formatSummaryAsMarkdown(content: any): string {
    if (!content) return '';
    
    let md = '';
    
    if (content.executiveSummary) {
      md += `# Executive Summary\n\n${content.executiveSummary}\n\n`;
    }
    
    if (content.topics?.length) {
      md += `# Topics Discussed\n\n`;
      for (const topic of content.topics) {
        md += `## ${topic.title}\n\n${topic.summary}\n\n`;
      }
    }
    
    if (content.decisions?.length) {
      md += `# Key Decisions\n\n`;
      for (const decision of content.decisions) {
        md += `- ${decision}\n`;
      }
      md += '\n';
    }
    
    if (content.actionItems?.length) {
      md += `# Action Items\n\n`;
      for (const item of content.actionItems) {
        const assignee = item.assignee ? ` (${item.assignee})` : '';
        const due = item.dueDate ? ` - Due: ${item.dueDate}` : '';
        md += `- [ ] ${item.text}${assignee}${due}\n`;
      }
    }
    
    return md;
  }
  
  private generateReadme(): string {
    return `
zigznote Data Export
====================

This archive contains your personal data exported from zigznote.

Contents:
- user-profile.json: Your account information and preferences
- meetings/: Directory containing all your meetings
  - index.json: Summary of all meetings
  - [meeting-id]/meeting.json: Full meeting details
  - [meeting-id]/transcript.txt: Meeting transcript (if available)
  - [meeting-id]/summary.md: Meeting summary (if available)
- action-items.json: All action items assigned to or created by you
- ai-conversations.json: Your AI chat conversations
- api-keys.json: Your API keys (hashes not included for security)

Data Format:
- All dates are in ISO 8601 format
- All files are UTF-8 encoded

Questions?
Contact support@zigznote.com

Exported on: ${new Date().toISOString()}
    `.trim();
  }
}

export const dataExportService = new DataExportService();
```

### 3.3 Data Export API

```typescript
// apps/api/src/routes/dataExport.ts

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { dataExportService } from '../services/dataExportService';
import { emailQueue } from '@zigznote/shared';

export const dataExportRouter = Router();

const requestExportSchema = z.object({
  includeAudio: z.boolean().default(false),
});

// POST /api/v1/account/export
// Request a data export
dataExportRouter.post('/export', requireAuth, async (req, res, next) => {
  try {
    const { userId, organizationId } = req.auth!;
    
    const parsed = requestExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error });
    }
    
    // Check for recent export request (rate limit - 1 per day)
    const recentExport = await prisma.dataExport.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    
    if (recentExport) {
      return res.status(429).json({
        success: false,
        error: 'You can only request one data export per day',
        nextAvailableAt: new Date(recentExport.createdAt.getTime() + 24 * 60 * 60 * 1000),
      });
    }
    
    // Create export record
    const exportRecord = await prisma.dataExport.create({
      data: {
        userId,
        organizationId,
        status: 'pending',
        includeAudio: parsed.data.includeAudio,
      },
    });
    
    // Queue export job (large exports done async)
    await dataExportQueue.add('generate-export', {
      exportId: exportRecord.id,
      userId,
      organizationId,
      includeAudio: parsed.data.includeAudio,
    });
    
    res.json({
      success: true,
      data: {
        exportId: exportRecord.id,
        status: 'pending',
        message: 'Your data export is being prepared. You will receive an email when it is ready.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/account/export/:id
// Check export status
dataExportRouter.get('/export/:id', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.auth!;
    const { id } = req.params;
    
    const exportRecord = await prisma.dataExport.findFirst({
      where: { id, userId },
    });
    
    if (!exportRecord) {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }
    
    res.json({
      success: true,
      data: {
        id: exportRecord.id,
        status: exportRecord.status,
        downloadUrl: exportRecord.downloadUrl,
        expiresAt: exportRecord.expiresAt,
        sizeBytes: exportRecord.sizeBytes,
        createdAt: exportRecord.createdAt,
        completedAt: exportRecord.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
```

### 3.4 Data Export Schema

```prisma
// Add to schema.prisma

model DataExport {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  organizationId String   @map("organization_id")
  
  status         String   @default("pending") // pending, processing, completed, failed
  includeAudio   Boolean  @default(false) @map("include_audio")
  
  downloadUrl    String?  @map("download_url")
  expiresAt      DateTime? @map("expires_at")
  sizeBytes      Int?     @map("size_bytes")
  errorMessage   String?  @map("error_message")
  
  createdAt      DateTime @default(now()) @map("created_at")
  completedAt    DateTime? @map("completed_at")
  
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
  @@map("data_exports")
}
```

---

## 4. Usage Quota Enforcement

### 4.1 Overview

Implement middleware and services to enforce plan limits.

### 4.2 Quota Service

```typescript
// apps/api/src/services/quotaService.ts

import { prisma } from '@zigznote/database';
import { ForbiddenError } from '@zigznote/shared';

interface PlanLimits {
  meetingsPerMonth: number;
  transcriptionMinutesPerMonth: number;
  storageGb: number;
  teamMembers: number;
  concurrentBots: number;
  apiRequestsPerDay: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    meetingsPerMonth: 5,
    transcriptionMinutesPerMonth: 60,
    storageGb: 1,
    teamMembers: 1,
    concurrentBots: 1,
    apiRequestsPerDay: 100,
  },
  pro: {
    meetingsPerMonth: 100,
    transcriptionMinutesPerMonth: 1200, // 20 hours
    storageGb: 50,
    teamMembers: 10,
    concurrentBots: 3,
    apiRequestsPerDay: 10000,
  },
  enterprise: {
    meetingsPerMonth: -1, // unlimited
    transcriptionMinutesPerMonth: -1,
    storageGb: 500,
    teamMembers: -1,
    concurrentBots: 10,
    apiRequestsPerDay: -1,
  },
};

class QuotaService {
  /**
   * Get current usage for an organization
   */
  async getUsage(organizationId: string): Promise<{
    meetingsThisMonth: number;
    transcriptionMinutesThisMonth: number;
    storageUsedGb: number;
    teamMemberCount: number;
    activeBots: number;
    apiRequestsToday: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const [
      meetingsThisMonth,
      transcriptionMinutes,
      storageUsed,
      teamMemberCount,
      activeBots,
      apiRequestsToday,
    ] = await Promise.all([
      // Meetings this month
      prisma.meeting.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      
      // Transcription minutes this month
      prisma.meeting.aggregate({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
          deletedAt: null,
          transcript: { isNot: null },
        },
        _sum: { duration: true },
      }).then(r => Math.ceil((r._sum.duration || 0) / 60)),
      
      // Storage used (sum of audio file sizes)
      prisma.meeting.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          audioFileSize: { not: null },
        },
        _sum: { audioFileSize: true },
      }).then(r => (r._sum.audioFileSize || 0) / (1024 * 1024 * 1024)),
      
      // Team members
      prisma.user.count({
        where: { organizationId, deletedAt: null },
      }),
      
      // Active bots
      prisma.meeting.count({
        where: {
          organizationId,
          status: { in: ['joining', 'in_progress', 'recording'] },
        },
      }),
      
      // API requests today
      prisma.apiRequestLog.count({
        where: {
          organizationId,
          createdAt: { gte: startOfDay },
        },
      }),
    ]);
    
    return {
      meetingsThisMonth,
      transcriptionMinutesThisMonth: transcriptionMinutes,
      storageUsedGb: storageUsed,
      teamMemberCount,
      activeBots,
      apiRequestsToday,
    };
  }
  
  /**
   * Get plan limits for an organization
   */
  async getLimits(organizationId: string): Promise<PlanLimits> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, limits: true },
    });
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    // Check for custom limits (enterprise overrides)
    if (org.limits) {
      return { ...PLAN_LIMITS[org.plan || 'free'], ...(org.limits as Partial<PlanLimits>) };
    }
    
    return PLAN_LIMITS[org.plan || 'free'];
  }
  
  /**
   * Check if an action is allowed within quota
   */
  async checkQuota(
    organizationId: string,
    action: 'create_meeting' | 'create_bot' | 'api_request' | 'add_member'
  ): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
    const [usage, limits] = await Promise.all([
      this.getUsage(organizationId),
      this.getLimits(organizationId),
    ]);
    
    switch (action) {
      case 'create_meeting':
        if (limits.meetingsPerMonth === -1) return { allowed: true };
        if (usage.meetingsThisMonth >= limits.meetingsPerMonth) {
          return {
            allowed: false,
            reason: 'Monthly meeting limit reached',
            currentUsage: usage.meetingsThisMonth,
            limit: limits.meetingsPerMonth,
          };
        }
        return { allowed: true };
        
      case 'create_bot':
        if (limits.concurrentBots === -1) return { allowed: true };
        if (usage.activeBots >= limits.concurrentBots) {
          return {
            allowed: false,
            reason: 'Concurrent bot limit reached',
            currentUsage: usage.activeBots,
            limit: limits.concurrentBots,
          };
        }
        return { allowed: true };
        
      case 'api_request':
        if (limits.apiRequestsPerDay === -1) return { allowed: true };
        if (usage.apiRequestsToday >= limits.apiRequestsPerDay) {
          return {
            allowed: false,
            reason: 'Daily API request limit reached',
            currentUsage: usage.apiRequestsToday,
            limit: limits.apiRequestsPerDay,
          };
        }
        return { allowed: true };
        
      case 'add_member':
        if (limits.teamMembers === -1) return { allowed: true };
        if (usage.teamMemberCount >= limits.teamMembers) {
          return {
            allowed: false,
            reason: 'Team member limit reached',
            currentUsage: usage.teamMemberCount,
            limit: limits.teamMembers,
          };
        }
        return { allowed: true };
        
      default:
        return { allowed: true };
    }
  }
  
  /**
   * Enforce quota (throws if exceeded)
   */
  async enforceQuota(
    organizationId: string,
    action: 'create_meeting' | 'create_bot' | 'api_request' | 'add_member'
  ): Promise<void> {
    const result = await this.checkQuota(organizationId, action);
    
    if (!result.allowed) {
      throw new ForbiddenError(
        `${result.reason}. Current: ${result.currentUsage}/${result.limit}. ` +
        `Please upgrade your plan for higher limits.`
      );
    }
  }
}

export const quotaService = new QuotaService();
```

### 4.3 Quota Middleware

```typescript
// apps/api/src/middleware/quotaCheck.ts

import { Request, Response, NextFunction } from 'express';
import { quotaService } from '../services/quotaService';
import { AuthenticatedRequest } from './auth';

type QuotaAction = 'create_meeting' | 'create_bot' | 'api_request' | 'add_member';

export function requireQuota(action: QuotaAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    
    if (!organizationId) {
      return next();
    }
    
    try {
      await quotaService.enforceQuota(organizationId, action);
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: error.message,
          },
        });
      }
      next(error);
    }
  };
}
```

### 4.4 Apply Quota Checks

```typescript
// apps/api/src/routes/meetings.ts - Update routes

import { requireQuota } from '../middleware/quotaCheck';

// POST /api/v1/meetings - Create meeting
router.post(
  '/',
  requireAuth,
  requireQuota('create_meeting'),
  meetingController.create.bind(meetingController)
);

// POST /api/v1/meetings/:id/bot - Start recording
router.post(
  '/:id/bot',
  requireAuth,
  requireQuota('create_bot'),
  meetingController.startBot.bind(meetingController)
);
```

### 4.5 Usage Dashboard API

```typescript
// apps/api/src/routes/usage.ts

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { quotaService } from '../services/quotaService';

export const usageRouter = Router();

// GET /api/v1/usage
usageRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { organizationId } = req.auth!;
    
    const [usage, limits] = await Promise.all([
      quotaService.getUsage(organizationId),
      quotaService.getLimits(organizationId),
    ]);
    
    res.json({
      success: true,
      data: {
        usage,
        limits,
        percentages: {
          meetings: limits.meetingsPerMonth === -1 ? 0 : 
            Math.round((usage.meetingsThisMonth / limits.meetingsPerMonth) * 100),
          transcription: limits.transcriptionMinutesPerMonth === -1 ? 0 :
            Math.round((usage.transcriptionMinutesThisMonth / limits.transcriptionMinutesPerMonth) * 100),
          storage: Math.round((usage.storageUsedGb / limits.storageGb) * 100),
          teamMembers: limits.teamMembers === -1 ? 0 :
            Math.round((usage.teamMemberCount / limits.teamMembers) * 100),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});
```

---

## 5. Meeting Export

### 5.1 Overview

Enable users to export meetings in various formats.

### 5.2 Export Service

```typescript
// apps/api/src/services/meetingExportService.ts

import { prisma } from '@zigznote/database';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

type ExportFormat = 'pdf' | 'docx' | 'txt' | 'srt' | 'json';

interface ExportOptions {
  meetingId: string;
  format: ExportFormat;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  includeTimestamps?: boolean;
}

class MeetingExportService {
  async export(options: ExportOptions): Promise<Buffer> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: options.meetingId },
      include: {
        transcript: true,
        summary: true,
        actionItems: true,
        participants: true,
      },
    });
    
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    
    switch (options.format) {
      case 'pdf':
        return this.exportPdf(meeting, options);
      case 'docx':
        return this.exportDocx(meeting, options);
      case 'txt':
        return this.exportTxt(meeting, options);
      case 'srt':
        return this.exportSrt(meeting);
      case 'json':
        return this.exportJson(meeting);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }
  
  private async exportPdf(meeting: any, options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Header
      doc.fontSize(24).text(meeting.title || 'Untitled Meeting', { align: 'center' });
      doc.moveDown();
      
      // Metadata
      doc.fontSize(12).fillColor('#666666');
      if (meeting.startTime) {
        doc.text(`Date: ${meeting.startTime.toLocaleDateString()}`);
      }
      if (meeting.duration) {
        doc.text(`Duration: ${Math.round(meeting.duration / 60)} minutes`);
      }
      if (meeting.participants.length > 0) {
        doc.text(`Participants: ${meeting.participants.map((p: any) => p.name).join(', ')}`);
      }
      doc.moveDown();
      doc.fillColor('#000000');
      
      // Summary
      if (options.includeSummary !== false && meeting.summary?.content) {
        const summary = meeting.summary.content;
        
        doc.fontSize(16).text('Executive Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(summary.executiveSummary || '');
        doc.moveDown();
        
        if (summary.decisions?.length > 0) {
          doc.fontSize(14).text('Key Decisions');
          doc.moveDown(0.5);
          for (const decision of summary.decisions) {
            doc.fontSize(11).text(`• ${decision}`);
          }
          doc.moveDown();
        }
      }
      
      // Action Items
      if (options.includeActionItems !== false && meeting.actionItems.length > 0) {
        doc.fontSize(16).text('Action Items', { underline: true });
        doc.moveDown(0.5);
        
        for (const item of meeting.actionItems) {
          const assignee = item.assignee ? ` (${item.assignee})` : '';
          const dueDate = item.dueDate ? ` - Due: ${item.dueDate.toLocaleDateString()}` : '';
          doc.fontSize(11).text(`☐ ${item.title}${assignee}${dueDate}`);
        }
        doc.moveDown();
      }
      
      // Transcript
      if (options.includeTranscript !== false && meeting.transcript?.fullText) {
        doc.addPage();
        doc.fontSize(16).text('Full Transcript', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(meeting.transcript.fullText, {
          align: 'justify',
          lineGap: 2,
        });
      }
      
      doc.end();
    });
  }
  
  private async exportDocx(meeting: any, options: ExportOptions): Promise<Buffer> {
    const children: any[] = [];
    
    // Title
    children.push(
      new Paragraph({
        text: meeting.title || 'Untitled Meeting',
        heading: HeadingLevel.TITLE,
      })
    );
    
    // Metadata
    if (meeting.startTime) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Date: ', bold: true }),
            new TextRun(meeting.startTime.toLocaleDateString()),
          ],
        })
      );
    }
    
    // Summary
    if (options.includeSummary !== false && meeting.summary?.content) {
      const summary = meeting.summary.content;
      
      children.push(
        new Paragraph({
          text: 'Executive Summary',
          heading: HeadingLevel.HEADING_1,
        })
      );
      
      children.push(
        new Paragraph({
          text: summary.executiveSummary || '',
        })
      );
      
      if (summary.decisions?.length > 0) {
        children.push(
          new Paragraph({
            text: 'Key Decisions',
            heading: HeadingLevel.HEADING_2,
          })
        );
        
        for (const decision of summary.decisions) {
          children.push(
            new Paragraph({
              text: `• ${decision}`,
            })
          );
        }
      }
    }
    
    // Action Items
    if (options.includeActionItems !== false && meeting.actionItems.length > 0) {
      children.push(
        new Paragraph({
          text: 'Action Items',
          heading: HeadingLevel.HEADING_1,
        })
      );
      
      for (const item of meeting.actionItems) {
        const assignee = item.assignee ? ` (${item.assignee})` : '';
        children.push(
          new Paragraph({
            text: `☐ ${item.title}${assignee}`,
          })
        );
      }
    }
    
    // Transcript
    if (options.includeTranscript !== false && meeting.transcript?.fullText) {
      children.push(
        new Paragraph({
          text: 'Full Transcript',
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: true,
        })
      );
      
      // Split transcript into paragraphs
      const paragraphs = meeting.transcript.fullText.split('\n\n');
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            text: para,
          })
        );
      }
    }
    
    const doc = new Document({
      sections: [{ children }],
    });
    
    return Packer.toBuffer(doc);
  }
  
  private async exportTxt(meeting: any, options: ExportOptions): Promise<Buffer> {
    let content = '';
    
    // Header
    content += `${meeting.title || 'Untitled Meeting'}\n`;
    content += '='.repeat(50) + '\n\n';
    
    if (meeting.startTime) {
      content += `Date: ${meeting.startTime.toLocaleDateString()}\n`;
    }
    if (meeting.duration) {
      content += `Duration: ${Math.round(meeting.duration / 60)} minutes\n`;
    }
    content += '\n';
    
    // Summary
    if (options.includeSummary !== false && meeting.summary?.content) {
      const summary = meeting.summary.content;
      
      content += 'EXECUTIVE SUMMARY\n';
      content += '-'.repeat(30) + '\n';
      content += (summary.executiveSummary || '') + '\n\n';
      
      if (summary.decisions?.length > 0) {
        content += 'KEY DECISIONS\n';
        content += '-'.repeat(30) + '\n';
        for (const decision of summary.decisions) {
          content += `• ${decision}\n`;
        }
        content += '\n';
      }
    }
    
    // Action Items
    if (options.includeActionItems !== false && meeting.actionItems.length > 0) {
      content += 'ACTION ITEMS\n';
      content += '-'.repeat(30) + '\n';
      for (const item of meeting.actionItems) {
        const assignee = item.assignee ? ` (${item.assignee})` : '';
        content += `[ ] ${item.title}${assignee}\n`;
      }
      content += '\n';
    }
    
    // Transcript
    if (options.includeTranscript !== false && meeting.transcript?.fullText) {
      content += 'FULL TRANSCRIPT\n';
      content += '-'.repeat(30) + '\n';
      content += meeting.transcript.fullText + '\n';
    }
    
    return Buffer.from(content, 'utf-8');
  }
  
  private async exportSrt(meeting: any): Promise<Buffer> {
    if (!meeting.transcript?.segments) {
      throw new Error('No transcript segments available for SRT export');
    }
    
    const segments = meeting.transcript.segments as Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
    }>;
    
    let srt = '';
    
    segments.forEach((segment, index) => {
      const startTime = this.msToSrtTime(segment.startMs);
      const endTime = this.msToSrtTime(segment.endMs);
      
      srt += `${index + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${segment.speaker ? `[${segment.speaker}] ` : ''}${segment.text}\n`;
      srt += '\n';
    });
    
    return Buffer.from(srt, 'utf-8');
  }
  
  private msToSrtTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }
  
  private async exportJson(meeting: any): Promise<Buffer> {
    const data = {
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      duration: meeting.duration,
      platform: meeting.platform,
      participants: meeting.participants.map((p: any) => ({
        name: p.name,
        email: p.email,
      })),
      summary: meeting.summary?.content,
      actionItems: meeting.actionItems.map((a: any) => ({
        title: a.title,
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        status: a.status,
        priority: a.priority,
      })),
      transcript: {
        fullText: meeting.transcript?.fullText,
        segments: meeting.transcript?.segments,
      },
      exportedAt: new Date().toISOString(),
    };
    
    return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  }
}

export const meetingExportService = new MeetingExportService();
```

### 5.3 Export API Route

```typescript
// apps/api/src/routes/meetings.ts - Add export endpoint

import { meetingExportService } from '../services/meetingExportService';

// GET /api/v1/meetings/:id/export
router.get('/:id/export', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.auth!;
    const format = (req.query.format as string) || 'pdf';
    
    // Verify meeting belongs to org
    const meeting = await prisma.meeting.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    const buffer = await meetingExportService.export({
      meetingId: id,
      format: format as any,
      includeTranscript: req.query.transcript !== 'false',
      includeSummary: req.query.summary !== 'false',
      includeActionItems: req.query.actionItems !== 'false',
    });
    
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      srt: 'text/plain',
      json: 'application/json',
    };
    
    const extensions: Record<string, string> = {
      pdf: 'pdf',
      docx: 'docx',
      txt: 'txt',
      srt: 'srt',
      json: 'json',
    };
    
    const filename = `${meeting.title || 'meeting'}-${meeting.id}.${extensions[format]}`;
    
    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
```

### 5.4 Export UI Component

```tsx
// apps/web/components/meetings/ExportMenu.tsx

'use client';

import { useState } from 'react';
import { 
  Download, 
  FileText, 
  FileType, 
  Subtitles, 
  Code, 
  ChevronDown,
  Loader2 
} from 'lucide-react';

interface ExportMenuProps {
  meetingId: string;
  meetingTitle: string;
}

export function ExportMenu({ meetingId, meetingTitle }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  
  const formats = [
    { id: 'pdf', label: 'PDF Document', icon: FileText, ext: 'pdf' },
    { id: 'docx', label: 'Word Document', icon: FileType, ext: 'docx' },
    { id: 'txt', label: 'Plain Text', icon: FileText, ext: 'txt' },
    { id: 'srt', label: 'Subtitles (SRT)', icon: Subtitles, ext: 'srt' },
    { id: 'json', label: 'JSON Data', icon: Code, ext: 'json' },
  ];
  
  const handleExport = async (format: string) => {
    setIsExporting(format);
    
    try {
      const response = await fetch(`/api/v1/meetings/${meetingId}/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meetingTitle || 'meeting'}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      // Show toast error
    } finally {
      setIsExporting(null);
      setIsOpen(false);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
            <div className="p-2">
              {formats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.id)}
                  disabled={isExporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  {isExporting === format.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <format.icon className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{format.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 6. Meeting Sharing

### 6.1 Database Schema

```prisma
// Add to schema.prisma

model MeetingShare {
  id             String   @id @default(uuid())
  meetingId      String   @map("meeting_id")
  
  // Share configuration
  shareType      String   @map("share_type") // 'link' | 'email'
  accessLevel    String   @map("access_level") // 'view' | 'comment'
  
  // For email shares
  recipientEmail String?  @map("recipient_email")
  recipientName  String?  @map("recipient_name")
  
  // For link shares
  shareToken     String?  @unique @map("share_token") // Random token for public links
  
  // Security
  password       String?  // Optional password protection
  expiresAt      DateTime? @map("expires_at")
  maxViews       Int?     @map("max_views")
  viewCount      Int      @default(0) @map("view_count")
  
  // Content permissions
  includeTranscript  Boolean @default(true) @map("include_transcript")
  includeSummary     Boolean @default(true) @map("include_summary")
  includeActionItems Boolean @default(true) @map("include_action_items")
  includeRecording   Boolean @default(false) @map("include_recording")
  
  // Metadata
  message        String?  // Personal message from sharer
  sharedById     String   @map("shared_by_id")
  
  createdAt      DateTime @default(now()) @map("created_at")
  lastAccessedAt DateTime? @map("last_accessed_at")
  revokedAt      DateTime? @map("revoked_at")
  
  meeting        Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  sharedBy       User     @relation(fields: [sharedById], references: [id])
  
  @@index([meetingId])
  @@index([shareToken])
  @@index([recipientEmail])
  @@map("meeting_shares")
}
```

### 6.2 Sharing Service

```typescript
// apps/api/src/services/meetingShareService.ts

import { prisma } from '@zigznote/database';
import { randomBytes } from 'crypto';
import { emailQueue } from '@zigznote/shared';
import bcrypt from 'bcrypt';

interface CreateShareOptions {
  meetingId: string;
  sharedById: string;
  shareType: 'link' | 'email';
  accessLevel: 'view' | 'comment';
  recipientEmail?: string;
  recipientName?: string;
  password?: string;
  expiresAt?: Date;
  maxViews?: number;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  includeRecording?: boolean;
  message?: string;
}

class MeetingShareService {
  /**
   * Create a share link or email share
   */
  async createShare(options: CreateShareOptions) {
    const {
      meetingId,
      sharedById,
      shareType,
      accessLevel,
      recipientEmail,
      recipientName,
      password,
      expiresAt,
      maxViews,
      includeTranscript = true,
      includeSummary = true,
      includeActionItems = true,
      includeRecording = false,
      message,
    } = options;
    
    // Generate share token for link shares
    const shareToken = shareType === 'link' 
      ? randomBytes(32).toString('base64url') 
      : null;
    
    // Hash password if provided
    const hashedPassword = password 
      ? await bcrypt.hash(password, 10) 
      : null;
    
    const share = await prisma.meetingShare.create({
      data: {
        meetingId,
        sharedById,
        shareType,
        accessLevel,
        recipientEmail,
        recipientName,
        shareToken,
        password: hashedPassword,
        expiresAt,
        maxViews,
        includeTranscript,
        includeSummary,
        includeActionItems,
        includeRecording,
        message,
      },
      include: {
        meeting: { select: { title: true, startTime: true } },
        sharedBy: { select: { name: true, email: true } },
      },
    });
    
    // Send email if email share
    if (shareType === 'email' && recipientEmail) {
      const shareUrl = `${process.env.APP_URL}/shared/${share.id}`;
      
      await emailQueue.add('meeting-shared', {
        type: 'meeting-shared',
        to: recipientEmail,
        data: {
          recipientName,
          senderName: share.sharedBy.name,
          meetingTitle: share.meeting.title,
          meetingDate: share.meeting.startTime?.toLocaleDateString(),
          message,
          shareUrl,
          expiresAt: expiresAt?.toLocaleDateString(),
        },
      });
    }
    
    return {
      ...share,
      shareUrl: shareToken 
        ? `${process.env.APP_URL}/s/${shareToken}` 
        : `${process.env.APP_URL}/shared/${share.id}`,
    };
  }
  
  /**
   * Access a shared meeting
   */
  async accessShare(shareToken: string, password?: string) {
    const share = await prisma.meetingShare.findFirst({
      where: {
        OR: [
          { shareToken },
          { id: shareToken },
        ],
        revokedAt: null,
      },
      include: {
        meeting: {
          include: {
            transcript: true,
            summary: true,
            actionItems: true,
            participants: true,
          },
        },
        sharedBy: { select: { name: true } },
      },
    });
    
    if (!share) {
      throw new Error('Share not found or has been revoked');
    }
    
    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new Error('This share link has expired');
    }
    
    // Check view limit
    if (share.maxViews && share.viewCount >= share.maxViews) {
      throw new Error('This share link has reached its view limit');
    }
    
    // Check password
    if (share.password) {
      if (!password) {
        return { requiresPassword: true };
      }
      const validPassword = await bcrypt.compare(password, share.password);
      if (!validPassword) {
        throw new Error('Invalid password');
      }
    }
    
    // Increment view count
    await prisma.meetingShare.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
    
    // Filter meeting data based on permissions
    const meeting = share.meeting;
    
    return {
      share: {
        id: share.id,
        accessLevel: share.accessLevel,
        message: share.message,
        sharedBy: share.sharedBy.name,
        expiresAt: share.expiresAt,
      },
      meeting: {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        duration: meeting.duration,
        participants: meeting.participants.map(p => ({ name: p.name })),
        transcript: share.includeTranscript ? meeting.transcript : null,
        summary: share.includeSummary ? meeting.summary : null,
        actionItems: share.includeActionItems ? meeting.actionItems : [],
        // Audio URL only if includeRecording is true
        audioUrl: share.includeRecording ? meeting.audioFileUrl : null,
      },
    };
  }
  
  /**
   * Revoke a share
   */
  async revokeShare(shareId: string, userId: string) {
    const share = await prisma.meetingShare.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });
    
    if (!share) {
      throw new Error('Share not found');
    }
    
    await prisma.meetingShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }
  
  /**
   * List shares for a meeting
   */
  async listShares(meetingId: string) {
    return prisma.meetingShare.findMany({
      where: {
        meetingId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const meetingShareService = new MeetingShareService();
```

### 6.3 Share API Routes

```typescript
// apps/api/src/routes/shares.ts

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { meetingShareService } from '../services/meetingShareService';

export const sharesRouter = Router();

const createShareSchema = z.object({
  shareType: z.enum(['link', 'email']),
  accessLevel: z.enum(['view', 'comment']).default('view'),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  password: z.string().min(4).max(50).optional(),
  expiresAt: z.coerce.date().optional(),
  maxViews: z.number().int().min(1).max(1000).optional(),
  includeTranscript: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeActionItems: z.boolean().default(true),
  includeRecording: z.boolean().default(false),
  message: z.string().max(500).optional(),
});

// POST /api/v1/meetings/:meetingId/shares
sharesRouter.post(
  '/meetings/:meetingId/shares',
  requireAuth,
  async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const { userId, organizationId } = req.auth!;
      
      // Verify meeting ownership
      const meeting = await prisma.meeting.findFirst({
        where: { id: meetingId, organizationId, deletedAt: null },
      });
      
      if (!meeting) {
        return res.status(404).json({ success: false, error: 'Meeting not found' });
      }
      
      const parsed = createShareSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      
      const share = await meetingShareService.createShare({
        meetingId,
        sharedById: userId,
        ...parsed.data,
      });
      
      res.json({ success: true, data: share });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/meetings/:meetingId/shares
sharesRouter.get(
  '/meetings/:meetingId/shares',
  requireAuth,
  async (req, res, next) => {
    try {
      const { meetingId } = req.params;
      const shares = await meetingShareService.listShares(meetingId);
      res.json({ success: true, data: shares });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/shares/:shareId
sharesRouter.delete('/shares/:shareId', requireAuth, async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const { userId } = req.auth!;
    
    await meetingShareService.revokeShare(shareId, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/shared/:token (public - no auth required)
sharesRouter.get('/shared/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.query;
    
    const result = await meetingShareService.accessShare(
      token,
      password as string | undefined
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
```

---

## 7. Transcript Editing

### 7.1 Database Changes

```prisma
// Add to Transcript model

model Transcript {
  // ... existing fields
  
  // Edit tracking
  editedAt       DateTime? @map("edited_at")
  editedById     String?   @map("edited_by_id")
  originalText   String?   @map("original_text") // Preserved for undo
  editHistory    Json?     @map("edit_history") // Array of edits
  
  // ... relations
}
```

### 7.2 Transcript Edit Service

```typescript
// apps/api/src/services/transcriptEditService.ts

import { prisma } from '@zigznote/database';

interface EditOperation {
  type: 'replace' | 'insert' | 'delete';
  startIndex: number;
  endIndex?: number;
  newText?: string;
  segmentIndex?: number;
}

interface EditHistoryEntry {
  timestamp: string;
  userId: string;
  operations: EditOperation[];
  reason?: string;
}

class TranscriptEditService {
  /**
   * Update transcript text with edit tracking
   */
  async editTranscript(
    transcriptId: string,
    userId: string,
    edits: EditOperation[],
    reason?: string
  ) {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });
    
    if (!transcript) {
      throw new Error('Transcript not found');
    }
    
    // Preserve original if first edit
    const originalText = transcript.originalText || transcript.fullText;
    
    // Apply edits to fullText
    let newText = transcript.fullText;
    
    // Sort edits by startIndex descending to apply from end to start
    const sortedEdits = [...edits].sort((a, b) => b.startIndex - a.startIndex);
    
    for (const edit of sortedEdits) {
      switch (edit.type) {
        case 'replace':
          newText = 
            newText.slice(0, edit.startIndex) + 
            (edit.newText || '') + 
            newText.slice(edit.endIndex || edit.startIndex);
          break;
        case 'insert':
          newText = 
            newText.slice(0, edit.startIndex) + 
            (edit.newText || '') + 
            newText.slice(edit.startIndex);
          break;
        case 'delete':
          newText = 
            newText.slice(0, edit.startIndex) + 
            newText.slice(edit.endIndex || edit.startIndex);
          break;
      }
    }
    
    // Update edit history
    const editHistory = (transcript.editHistory as EditHistoryEntry[] || []);
    editHistory.push({
      timestamp: new Date().toISOString(),
      userId,
      operations: edits,
      reason,
    });
    
    // Update transcript
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: {
        fullText: newText,
        originalText,
        editHistory,
        editedAt: new Date(),
        editedById: userId,
      },
    });
    
    return { success: true, newText };
  }
  
  /**
   * Update a specific segment
   */
  async editSegment(
    transcriptId: string,
    segmentIndex: number,
    userId: string,
    updates: {
      text?: string;
      speaker?: string;
    }
  ) {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });
    
    if (!transcript || !transcript.segments) {
      throw new Error('Transcript or segments not found');
    }
    
    const segments = transcript.segments as Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
    }>;
    
    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      throw new Error('Invalid segment index');
    }
    
    // Update segment
    if (updates.text !== undefined) {
      segments[segmentIndex].text = updates.text;
    }
    if (updates.speaker !== undefined) {
      segments[segmentIndex].speaker = updates.speaker;
    }
    
    // Rebuild fullText from segments
    const newFullText = segments
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n\n');
    
    // Update transcript
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: {
        segments,
        fullText: newFullText,
        editedAt: new Date(),
        editedById: userId,
      },
    });
    
    return { success: true, segments };
  }
  
  /**
   * Revert to original transcript
   */
  async revertToOriginal(transcriptId: string, userId: string) {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });
    
    if (!transcript?.originalText) {
      throw new Error('No original text to revert to');
    }
    
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: {
        fullText: transcript.originalText,
        editedAt: new Date(),
        editedById: userId,
        // Keep editHistory for audit trail
      },
    });
    
    return { success: true };
  }
}

export const transcriptEditService = new TranscriptEditService();
```

### 7.3 Transcript Edit API

```typescript
// apps/api/src/routes/transcripts.ts

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { transcriptEditService } from '../services/transcriptEditService';

export const transcriptsRouter = Router();

const editTranscriptSchema = z.object({
  edits: z.array(z.object({
    type: z.enum(['replace', 'insert', 'delete']),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(0).optional(),
    newText: z.string().optional(),
  })),
  reason: z.string().max(200).optional(),
});

const editSegmentSchema = z.object({
  text: z.string().optional(),
  speaker: z.string().max(100).optional(),
});

// PATCH /api/v1/transcripts/:id
transcriptsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = req.auth!;
    
    // Verify transcript belongs to org
    const transcript = await prisma.transcript.findFirst({
      where: {
        id,
        meeting: { organizationId, deletedAt: null },
      },
    });
    
    if (!transcript) {
      return res.status(404).json({ success: false, error: 'Transcript not found' });
    }
    
    const parsed = editTranscriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error });
    }
    
    const result = await transcriptEditService.editTranscript(
      id,
      userId,
      parsed.data.edits,
      parsed.data.reason
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/transcripts/:id/segments/:index
transcriptsRouter.patch(
  '/:id/segments/:index',
  requireAuth,
  async (req, res, next) => {
    try {
      const { id, index } = req.params;
      const { userId, organizationId } = req.auth!;
      
      const transcript = await prisma.transcript.findFirst({
        where: {
          id,
          meeting: { organizationId, deletedAt: null },
        },
      });
      
      if (!transcript) {
        return res.status(404).json({ success: false, error: 'Transcript not found' });
      }
      
      const parsed = editSegmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      
      const result = await transcriptEditService.editSegment(
        id,
        parseInt(index),
        userId,
        parsed.data
      );
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/transcripts/:id/revert
transcriptsRouter.post('/:id/revert', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = req.auth!;
    
    const transcript = await prisma.transcript.findFirst({
      where: {
        id,
        meeting: { organizationId, deletedAt: null },
      },
    });
    
    if (!transcript) {
      return res.status(404).json({ success: false, error: 'Transcript not found' });
    }
    
    const result = await transcriptEditService.revertToOriginal(id, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
```

### 7.4 Editable Transcript Viewer Component

```tsx
// apps/web/components/meetings/EditableTranscript.tsx

'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Check, X, RotateCcw, Save } from 'lucide-react';

interface Segment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

interface EditableTranscriptProps {
  transcriptId: string;
  segments: Segment[];
  isEditable?: boolean;
}

export function EditableTranscript({
  transcriptId,
  segments: initialSegments,
  isEditable = true,
}: EditableTranscriptProps) {
  const [segments, setSegments] = useState(initialSegments);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editSpeaker, setEditSpeaker] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();
  
  const saveSegment = useMutation({
    mutationFn: async ({ index, text, speaker }: { 
      index: number; 
      text: string; 
      speaker: string; 
    }) => {
      const response = await fetch(
        `/api/v1/transcripts/${transcriptId}/segments/${index}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, speaker }),
        }
      );
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting'] });
      setEditingIndex(null);
    },
  });
  
  const revertTranscript = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/v1/transcripts/${transcriptId}/revert`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to revert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting'] });
    },
  });
  
  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditText(segments[index].text);
    setEditSpeaker(segments[index].speaker);
  };
  
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditText('');
    setEditSpeaker('');
  };
  
  const saveEdit = () => {
    if (editingIndex === null) return;
    
    // Update local state
    const newSegments = [...segments];
    newSegments[editingIndex] = {
      ...newSegments[editingIndex],
      text: editText,
      speaker: editSpeaker,
    };
    setSegments(newSegments);
    setHasChanges(true);
    
    // Save to server
    saveSegment.mutate({
      index: editingIndex,
      text: editText,
      speaker: editSpeaker,
    });
  };
  
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Transcript</h3>
        {isEditable && hasChanges && (
          <button
            onClick={() => revertTranscript.mutate()}
            disabled={revertTranscript.isPending}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
            Revert to original
          </button>
        )}
      </div>
      
      {/* Segments */}
      <div className="space-y-3">
        {segments.map((segment, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg ${
              editingIndex === index ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50'
            }`}
          >
            {editingIndex === index ? (
              /* Edit mode */
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editSpeaker}
                    onChange={(e) => setEditSpeaker(e.target.value)}
                    className="px-2 py-1 border rounded text-sm font-medium w-32"
                    placeholder="Speaker name"
                  />
                  <span className="text-xs text-slate-400 self-center">
                    {formatTime(segment.startMs)}
                  </span>
                </div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm min-h-[60px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saveSegment.isPending}
                    className="flex items-center gap-1 px-3 py-1 bg-primary-600 text-white rounded text-sm"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="flex items-center gap-1 px-3 py-1 border rounded text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-primary-700">
                      {segment.speaker}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatTime(segment.startMs)}
                    </span>
                  </div>
                  {isEditable && (
                    <button
                      onClick={() => startEditing(index)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-700 mt-1">{segment.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Database Schema Changes

### 8.1 Complete Schema Additions

```prisma
// Add all new models to schema.prisma

// Notification Preferences
model NotificationPreferences {
  id             String   @id @default(uuid())
  userId         String   @unique @map("user_id")
  
  emailMeetingReady       Boolean @default(true)
  emailActionItemReminder Boolean @default(true)
  emailWeeklyDigest       Boolean @default(true)
  emailMeetingShared      Boolean @default(true)
  emailPaymentAlerts      Boolean @default(true)
  actionItemReminderDays  Int     @default(1)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("notification_preferences")
}

// Organization Settings
model OrganizationSettings {
  id             String   @id @default(uuid())
  organizationId String   @unique @map("organization_id")
  
  recordingConsentEnabled  Boolean @default(true)
  consentAnnouncementText  String?
  requireExplicitConsent   Boolean @default(false)
  defaultBotName           String  @default("zigznote Notetaker")
  joinAnnouncementEnabled  Boolean @default(true)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("organization_settings")
}

// Data Export
model DataExport {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  organizationId String    @map("organization_id")
  
  status         String    @default("pending")
  includeAudio   Boolean   @default(false)
  downloadUrl    String?
  expiresAt      DateTime?
  sizeBytes      Int?
  errorMessage   String?
  
  createdAt      DateTime  @default(now())
  completedAt    DateTime?
  
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("data_exports")
}

// Meeting Share
model MeetingShare {
  id             String    @id @default(uuid())
  meetingId      String    @map("meeting_id")
  shareType      String    @map("share_type")
  accessLevel    String    @map("access_level")
  recipientEmail String?
  recipientName  String?
  shareToken     String?   @unique
  password       String?
  expiresAt      DateTime?
  maxViews       Int?
  viewCount      Int       @default(0)
  includeTranscript  Boolean @default(true)
  includeSummary     Boolean @default(true)
  includeActionItems Boolean @default(true)
  includeRecording   Boolean @default(false)
  message        String?
  sharedById     String    @map("shared_by_id")
  
  createdAt      DateTime  @default(now())
  lastAccessedAt DateTime?
  revokedAt      DateTime?
  
  meeting        Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  sharedBy       User      @relation(fields: [sharedById], references: [id])
  
  @@index([meetingId])
  @@index([shareToken])
  @@map("meeting_shares")
}

// API Request Log (for quota tracking)
model ApiRequestLog {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  userId         String?  @map("user_id")
  apiKeyId       String?  @map("api_key_id")
  
  method         String
  path           String
  statusCode     Int      @map("status_code")
  responseTimeMs Int      @map("response_time_ms")
  
  createdAt      DateTime @default(now())
  
  @@index([organizationId, createdAt])
  @@map("api_request_logs")
}

// Update Meeting model
model Meeting {
  // Add to existing fields:
  consentObtained    Boolean   @default(false)
  consentObtainedAt  DateTime?
  consentMethod      String?
  
  // Add relation
  shares             MeetingShare[]
}

// Update Transcript model
model Transcript {
  // Add to existing fields:
  editedAt       DateTime?
  editedById     String?
  originalText   String?
  editHistory    Json?
}

// Update User model
model User {
  // Add relations:
  notificationPreferences NotificationPreferences?
  dataExports            DataExport[]
  meetingShares          MeetingShare[]
}

// Update Organization model
model Organization {
  // Add relation:
  settings OrganizationSettings?
}
```

---

## 9. API Routes Summary

### New Routes

| Method | Path | Description |
|--------|------|-------------|
| **Email/Notifications** | | |
| GET | `/api/v1/notifications/preferences` | Get notification preferences |
| PATCH | `/api/v1/notifications/preferences` | Update preferences |
| **Consent Settings** | | |
| GET | `/api/v1/organization/settings` | Get org settings |
| PATCH | `/api/v1/organization/settings` | Update org settings |
| **GDPR Export** | | |
| POST | `/api/v1/account/export` | Request data export |
| GET | `/api/v1/account/export/:id` | Check export status |
| **Usage/Quota** | | |
| GET | `/api/v1/usage` | Get usage and limits |
| **Meeting Export** | | |
| GET | `/api/v1/meetings/:id/export` | Export meeting (PDF/DOCX/SRT/TXT/JSON) |
| **Meeting Sharing** | | |
| POST | `/api/v1/meetings/:id/shares` | Create share |
| GET | `/api/v1/meetings/:id/shares` | List shares |
| DELETE | `/api/v1/shares/:id` | Revoke share |
| GET | `/api/v1/shared/:token` | Access shared meeting (public) |
| **Transcript Editing** | | |
| PATCH | `/api/v1/transcripts/:id` | Edit transcript |
| PATCH | `/api/v1/transcripts/:id/segments/:index` | Edit segment |
| POST | `/api/v1/transcripts/:id/revert` | Revert to original |

---

## 10. Frontend Components

### New Pages

| Path | Component | Description |
|------|-----------|-------------|
| `/settings/notifications` | `NotificationSettings` | Email preferences |
| `/settings/recording` | `RecordingSettings` | Consent settings |
| `/settings/data` | `DataSettings` | Export/delete data |
| `/shared/:token` | `SharedMeeting` | Public shared meeting view |

### New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `ExportMenu` | `components/meetings/` | Export format dropdown |
| `ShareDialog` | `components/meetings/` | Create share modal |
| `SharesList` | `components/meetings/` | List active shares |
| `EditableTranscript` | `components/meetings/` | Inline transcript editing |
| `UsageCard` | `components/dashboard/` | Usage/quota display |
| `QuotaWarning` | `components/shared/` | Approaching limit alert |

---

## 11. Testing Requirements

### Unit Tests

```typescript
// Required test files

// Email
- emailService.test.ts
- emailWorker.test.ts
- templates.test.ts

// Consent
- organizationSettings.test.ts

// Export
- dataExportService.test.ts
- meetingExportService.test.ts

// Quota
- quotaService.test.ts
- quotaMiddleware.test.ts

// Sharing
- meetingShareService.test.ts

// Transcript Edit
- transcriptEditService.test.ts
```

### Integration Tests

```typescript
// API integration tests

describe('Email Notifications', () => {
  it('sends meeting ready email');
  it('respects user preferences');
  it('handles failed sends gracefully');
});

describe('Data Export', () => {
  it('generates complete export');
  it('rate limits to 1/day');
  it('includes all user data');
});

describe('Quota Enforcement', () => {
  it('blocks meeting creation at limit');
  it('blocks bot creation at limit');
  it('allows enterprise unlimited');
});

describe('Meeting Sharing', () => {
  it('creates public share link');
  it('sends email for email shares');
  it('enforces password protection');
  it('enforces expiration');
  it('enforces view limits');
});

describe('Transcript Editing', () => {
  it('edits segment text');
  it('edits speaker name');
  it('preserves original');
  it('reverts to original');
});
```

---

## 12. Environment Variables

```env
# Add to .env

# Email (Resend)
RESEND_API_KEY=re_xxxx
EMAIL_FROM_ADDRESS=notifications@zigznote.com
EMAIL_FROM_NAME=zigznote

# Optional: SendGrid fallback
SENDGRID_API_KEY=SG.xxxx

# App URL (for email links)
APP_URL=https://app.zigznote.com
```

---

## 13. Migration Order

1. **Database migrations** - Run Prisma migrate
2. **Email service** - Deploy notification worker
3. **Consent settings** - Update RecallService
4. **Quota enforcement** - Add middleware to routes
5. **Export features** - Add routes and UI
6. **Sharing** - Add routes, public page
7. **Transcript editing** - Add routes and UI

---

## 14. Estimated Implementation Time

| Feature | Backend | Frontend | Tests | Total |
|---------|---------|----------|-------|-------|
| Email System | 45 min | 30 min | 30 min | 1.75 hr |
| Consent Management | 30 min | 30 min | 15 min | 1.25 hr |
| GDPR Export | 45 min | 20 min | 20 min | 1.4 hr |
| Quota Enforcement | 30 min | 20 min | 20 min | 1.2 hr |
| Meeting Export | 45 min | 20 min | 20 min | 1.4 hr |
| Meeting Sharing | 60 min | 45 min | 30 min | 2.25 hr |
| Transcript Editing | 30 min | 45 min | 20 min | 1.6 hr |
| **Total** | **4.75 hr** | **3.5 hr** | **2.6 hr** | **~11 hr** |

---

## 15. Success Criteria

- [ ] All email types sending successfully
- [ ] Bot announces recording in meetings
- [ ] Users can export all their data
- [ ] Free plan limited to 5 meetings/month
- [ ] Meetings exportable as PDF, DOCX, SRT
- [ ] Meetings shareable via link or email
- [ ] Transcripts editable with undo
- [ ] 90%+ test coverage on new code
- [ ] No P0 bugs in production

---

**This phase must be complete before public launch.**
