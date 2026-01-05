# Phase 8.95.1: Critical Gap Fixes

## Overview

Three gaps were identified in the Phase 8.95 implementation. This spec provides exact fixes.

**Total Time:** ~1.75 hours  
**Priority:** Must complete before launch

---

## Gap 1: Webhook Idempotency Integration

**Problem:** `checkAndMarkProcessed()` exists but isn't called in webhook routes.

### Fix 1a: Recall Webhook

**File:** `apps/api/src/routes/webhooks/recall.ts`

```typescript
/**
 * Recall.ai webhook handler
 * Processes events for bot status changes, recordings, and transcriptions
 */

import { Router, Request, Response } from 'express';
import { recallService, type RecallWebhookEvent } from '../../services/recallService';
import { logger } from '../../utils/logger';
import { checkAndMarkProcessed } from '../../utils/webhookIdempotency';

const router: Router = Router();

/**
 * POST /webhooks/recall
 * Receives and processes Recall.ai webhook events
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get raw body for signature verification
    const rawBody = req.body instanceof Buffer
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    // Verify signature
    const signature = req.headers['x-recall-signature'] as string;

    if (signature) {
      const isValid = recallService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        logger.warn('Invalid Recall.ai webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Parse the event
    const event: RecallWebhookEvent = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    // === ADD: Idempotency check ===
    // Create unique event ID from bot_id + event type + timestamp (if available)
    const botId = event.data?.bot_id || 'unknown';
    const timestamp = event.data?.timestamp || event.data?.created_at || Date.now();
    const eventId = `${botId}-${event.event}-${timestamp}`;
    
    const isNew = await checkAndMarkProcessed('recall', eventId, event.event);
    if (!isNew) {
      logger.info({ eventId, event: event.event }, 'Duplicate Recall webhook, skipping');
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    // === END ADD ===

    logger.info({ event: event.event, botId: event.data?.bot_id }, 'Received Recall.ai webhook');

    // Process the event
    await recallService.handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, 'Error processing Recall.ai webhook');
    // Return 200 to prevent Recall.ai from retrying
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
```

### Fix 1b: Clerk Webhook

**File:** `apps/api/src/routes/webhooks/clerk.ts`

Add import at top:
```typescript
import { checkAndMarkProcessed } from '../../utils/webhookIdempotency';
```

Add after signature verification, before processing:
```typescript
    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    const payload = JSON.stringify(req.body);

    const event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;

    // === ADD: Idempotency check ===
    const isNew = await checkAndMarkProcessed('clerk', svixId, event.type);
    if (!isNew) {
      logger.info({ svixId, eventType: event.type }, 'Duplicate Clerk webhook, skipping');
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    // === END ADD ===

    // Process the event
    await authService.syncUserFromWebhook(event);
```

### Fix 1c: Stripe/Billing Webhook

**File:** `apps/api/src/billing/routes.ts`

Add import at top:
```typescript
import { checkAndMarkProcessed } from '../utils/webhookIdempotency';
```

Find the Stripe webhook handler and add after signature verification:
```typescript
    // After verifying Stripe signature...
    
    // === ADD: Idempotency check ===
    const stripeEventId = event.id; // Stripe provides unique event IDs
    const isNew = await checkAndMarkProcessed('stripe', stripeEventId, event.type);
    if (!isNew) {
      logger.info({ stripeEventId, eventType: event.type }, 'Duplicate Stripe webhook, skipping');
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    // === END ADD ===
    
    // Process webhook...
```

### Fix 1d: Flutterwave Webhook (if exists)

Apply same pattern - use the transaction reference as eventId:
```typescript
const isNew = await checkAndMarkProcessed('flutterwave', event.data.tx_ref, event.event);
```

---

## Gap 2: Database Transactions for Critical Operations

**Problem:** Multi-step operations can leave partial data on failure.

### Fix 2a: Meeting Creation with Bot

**File:** `apps/api/src/services/meetingService.ts`

Find the method that creates a meeting and optionally starts a bot. Wrap in transaction:

```typescript
import { prisma, Prisma } from '@zigznote/database';

/**
 * Create a meeting with optional bot
 * Uses transaction to ensure atomicity
 */
async createMeetingWithBot(
  data: {
    title: string;
    organizationId: string;
    userId: string;
    meetingUrl?: string;
    scheduledStart?: Date;
    scheduledEnd?: Date;
    startBot?: boolean;
  }
): Promise<Meeting> {
  return prisma.$transaction(async (tx) => {
    // Create the meeting
    const meeting = await tx.meeting.create({
      data: {
        title: data.title,
        organizationId: data.organizationId,
        userId: data.userId,
        meetingUrl: data.meetingUrl,
        scheduledStartTime: data.scheduledStart,
        scheduledEndTime: data.scheduledEnd,
        status: data.startBot ? 'pending' : 'scheduled',
      },
    });

    // If bot requested, create it
    if (data.startBot && data.meetingUrl) {
      try {
        const bot = await recallService.createBot({
          meetingUrl: data.meetingUrl,
          meetingId: meeting.id,
        });

        // Update meeting with bot info
        await tx.meeting.update({
          where: { id: meeting.id },
          data: {
            botId: bot.id,
            status: 'joining',
          },
        });
      } catch (error) {
        // Log but let transaction rollback
        logger.error({ meetingId: meeting.id, error }, 'Failed to create bot, rolling back meeting');
        throw error; // This rolls back the entire transaction
      }
    }

    return meeting;
  }, {
    maxWait: 5000, // 5s max wait to acquire lock
    timeout: 10000, // 10s max transaction duration
  });
}
```

### Fix 2b: User + Organization Creation

**File:** `apps/api/src/services/authService.ts`

Find where new users are created with their organization:

```typescript
/**
 * Sync user from Clerk webhook - creates user and org atomically
 */
async syncUserFromWebhook(event: ClerkWebhookEvent): Promise<void> {
  if (event.type === 'user.created') {
    await prisma.$transaction(async (tx) => {
      // Check if user already exists
      const existing = await tx.user.findUnique({
        where: { clerkId: event.data.id },
      });
      
      if (existing) return;

      // Create organization first
      const organization = await tx.organization.create({
        data: {
          name: `${event.data.first_name || 'User'}'s Workspace`,
          plan: 'free',
        },
      });

      // Create user linked to organization
      await tx.user.create({
        data: {
          clerkId: event.data.id,
          email: event.data.email_addresses?.[0]?.email_address || '',
          firstName: event.data.first_name || null,
          lastName: event.data.last_name || null,
          organizationId: organization.id,
          role: 'owner',
        },
      });

      logger.info({ clerkId: event.data.id, orgId: organization.id }, 'Created user and organization');
    });
  }
  
  // Handle other event types...
}
```

### Fix 2c: Subscription Creation

**File:** `apps/api/src/billing/BillingService.ts`

When creating a subscription with a customer:

```typescript
async createSubscription(
  organizationId: string,
  priceId: string,
  provider: PaymentProviderType
): Promise<Subscription> {
  return prisma.$transaction(async (tx) => {
    // Get or create customer
    let customer = await tx.billingCustomer.findFirst({
      where: { organizationId },
    });

    if (!customer) {
      // Create customer in payment provider
      const providerCustomer = await this.getProvider(provider).createCustomer({
        organizationId,
        // ... other data
      });

      customer = await tx.billingCustomer.create({
        data: {
          organizationId,
          provider,
          providerCustomerId: providerCustomer.id,
        },
      });
    }

    // Create subscription in provider
    const providerSub = await this.getProvider(provider).createSubscription({
      customerId: customer.providerCustomerId,
      priceId,
    });

    // Create local subscription record
    const subscription = await tx.subscription.create({
      data: {
        customerId: customer.id,
        provider,
        providerSubId: providerSub.id,
        status: 'active',
        priceId,
        currentPeriodStart: new Date(providerSub.current_period_start * 1000),
        currentPeriodEnd: new Date(providerSub.current_period_end * 1000),
      },
    });

    // Update organization plan
    await tx.organization.update({
      where: { id: organizationId },
      data: { plan: 'pro' }, // Or derive from priceId
    });

    return subscription;
  });
}
```

---

## Gap 3: Dunning Email Notifications

**Problem:** Payment failures don't notify users.

### Fix 3a: Create Email Templates

**File:** `apps/api/src/email/templates/payment-failed.ts`

```typescript
export const paymentFailedTemplates = {
  first: {
    subject: 'Action Required: Payment failed for zigznote',
    html: (data: { userName: string; graceEndsAt: string; updateUrl: string }) => `
      <h2>Hi ${data.userName},</h2>
      <p>We weren't able to process your payment for zigznote.</p>
      <p>Don't worry - your account is still active. We'll retry the payment automatically.</p>
      <p>To avoid any interruption, please update your payment method:</p>
      <p><a href="${data.updateUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Update Payment Method</a></p>
      <p>Your access will remain active until <strong>${data.graceEndsAt}</strong>.</p>
      <p>Questions? Just reply to this email.</p>
      <p>- The zigznote team</p>
    `,
  },
  
  second: {
    subject: 'Reminder: Please update your payment method',
    html: (data: { userName: string; graceEndsAt: string; updateUrl: string }) => `
      <h2>Hi ${data.userName},</h2>
      <p>This is a friendly reminder that your payment is still pending.</p>
      <p>Your account access will be paused on <strong>${data.graceEndsAt}</strong> if we can't process payment.</p>
      <p><a href="${data.updateUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Update Payment Method</a></p>
      <p>- The zigznote team</p>
    `,
  },
  
  final: {
    subject: 'Final notice: Your zigznote access will be paused soon',
    html: (data: { userName: string; graceEndsAt: string; updateUrl: string }) => `
      <h2>Hi ${data.userName},</h2>
      <p><strong>Your account access will be paused on ${data.graceEndsAt}.</strong></p>
      <p>We've tried to process your payment several times without success.</p>
      <p>Please update your payment method now to keep your access:</p>
      <p><a href="${data.updateUrl}" style="background: #DC2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Update Payment Now</a></p>
      <p>After your access is paused, you'll still be able to view your data but won't be able to record new meetings.</p>
      <p>- The zigznote team</p>
    `,
  },
};
```

### Fix 3b: Update BillingService

**File:** `apps/api/src/billing/BillingService.ts`

Add import:
```typescript
import { emailQueue } from '../jobs/queues';
import { paymentFailedTemplates } from '../email/templates/payment-failed';
```

Update `handlePaymentFailed`:

```typescript
private async handlePaymentFailed(
  provider: PaymentProviderType,
  data: Record<string, unknown>
): Promise<void> {
  console.log(`[Billing] Payment failed (${provider}):`, data.id);

  // Find subscription by provider ID
  const subscriptionId = (data.subscription as string) || (data.subscription_id as string);
  if (!subscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { providerSubId: subscriptionId, provider },
    include: { 
      customer: {
        include: {
          organization: {
            include: {
              users: {
                where: { role: 'owner' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!subscription) return;

  const retryCount = (subscription.paymentRetryCount || 0) + 1;

  // Calculate grace period end (only set on first failure)
  const graceEndsAt =
    subscription.graceEndsAt ||
    new Date(Date.now() + this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'past_due',
      graceEndsAt,
      paymentFailedAt: new Date(),
      paymentRetryCount: retryCount,
    },
  });

  console.log(
    `[Billing] Payment failed, grace period active until ${graceEndsAt.toISOString()} ` +
      `(attempt ${retryCount}/${this.MAX_RETRY_COUNT})`
  );

  // === ADD: Send dunning email ===
  const owner = subscription.customer?.organization?.users?.[0];
  if (owner?.email) {
    const templateKey = retryCount === 1 ? 'first' :
                        retryCount === 2 ? 'second' :
                        retryCount >= 3 ? 'final' : 'first';
    
    const template = paymentFailedTemplates[templateKey];
    const emailData = {
      userName: owner.firstName || 'there',
      graceEndsAt: graceEndsAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      updateUrl: `${config.webUrl}/settings/billing`,
    };

    await emailQueue.add('send-email', {
      to: owner.email,
      subject: template.subject,
      html: template.html(emailData),
    });

    console.log(`[Billing] Queued dunning email (${templateKey}) to ${owner.email}`);
  }
  // === END ADD ===
}
```

### Fix 3c: Add Email Queue (if not exists)

**File:** `apps/api/src/jobs/queues.ts`

Add email queue if it doesn't exist:

```typescript
import { Queue } from 'bullmq';
import { config } from '../config';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

// ... existing queues ...

export const emailQueue = new Queue('email', { connection });
```

### Fix 3d: Add Email Worker

**File:** `apps/api/src/jobs/emailWorker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';

const resend = new Resend(config.resend?.apiKey);

interface EmailJob {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const emailWorker = new Worker<EmailJob>(
  'email',
  async (job: Job<EmailJob>) => {
    const { to, subject, html, from } = job.data;

    try {
      await resend.emails.send({
        from: from || config.email?.from || 'zigznote <noreply@zigznote.com>',
        to,
        subject,
        html,
      });

      logger.info({ to, subject, jobId: job.id }, 'Email sent successfully');
    } catch (error) {
      logger.error({ to, subject, error }, 'Failed to send email');
      throw error; // Will retry
    }
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
    },
    concurrency: 5,
  }
);

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Email job failed');
});

export { emailWorker };
```

### Fix 3e: Start Email Worker

**File:** `apps/api/src/app.ts` or wherever workers are started

```typescript
import { emailWorker } from './jobs/emailWorker';

// In startup:
if (config.resend?.apiKey) {
  logger.info('Email worker started');
}
```

---

## Testing Checklist

After implementing fixes, verify:

### Webhook Idempotency
```bash
# Send same webhook twice
curl -X POST http://localhost:3001/webhooks/recall \
  -H "Content-Type: application/json" \
  -d '{"event": "bot.status_change", "data": {"bot_id": "test-123"}}'

# Second call should return { "received": true, "duplicate": true }
```

### Transactions
```bash
# Check database after failed bot creation
# Should NOT have orphaned meeting records
```

### Dunning Emails
```bash
# Trigger payment.failed webhook
# Check email queue for pending jobs
# Verify email content
```

---

## Files Summary

### Modified Files
- `apps/api/src/routes/webhooks/recall.ts`
- `apps/api/src/routes/webhooks/clerk.ts`
- `apps/api/src/billing/routes.ts`
- `apps/api/src/billing/BillingService.ts`
- `apps/api/src/services/meetingService.ts`
- `apps/api/src/services/authService.ts`
- `apps/api/src/app.ts`

### New Files
- `apps/api/src/email/templates/payment-failed.ts`
- `apps/api/src/jobs/emailWorker.ts`

---

## Verification Commands

```bash
# Run tests
pnpm --filter @zigznote/api test

# Check for TypeScript errors
pnpm --filter @zigznote/api type-check

# Verify webhook idempotency table
npx prisma studio
# Check processed_webhooks table
```

---

## Notes

- All fixes are backwards compatible
- No database migrations needed (ProcessedWebhook model already exists)
- Resend API key needed for emails (add to .env if not present)
- Transaction timeouts set conservatively (10s) - adjust if needed
