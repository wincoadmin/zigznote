# Phase 8.95: Critical Infrastructure Fixes

## Instructions for Claude Code

You are implementing 8 critical infrastructure fixes for zigznote. These are P0 launch blockers that must be completed before production deployment. Follow each section in order - they build on each other.

**Estimated Time:** 3-4 hours  
**Priority:** CRITICAL - Launch Blocker  
**Dependencies:** Phase 8.9 can proceed in parallel

---

## Overview of All Fixes

| # | Fix | New Files | DB Changes |
|---|-----|-----------|------------|
| 1 | Webhook Idempotency | 1 middleware, 1 migration | Yes |
| 2 | Duplicate Bot Prevention | Update recallService | No |
| 3 | Critical Transactions | Update 3 services | No |
| 4 | Orphaned Bot Cleanup | 1 new worker | No |
| 5 | Storage Cleanup | 1 new worker | No |
| 6 | API Key Brute Force Protection | Update apiKeyAuth | No |
| 7 | Payment Grace Period | Update billingService, 1 migration | Yes |
| 8 | Plan Downgrade Handling | Update billingService, 1 migration | Yes |

---

## Fix 1: Webhook Idempotency

### Problem
Webhooks from Recall.ai, Clerk, Stripe, and Deepgram can be delivered multiple times. Without deduplication, the same event processes repeatedly causing duplicate data.

### Requirements

1. **Create ProcessedWebhook model** in `packages/database/prisma/schema.prisma`:

```prisma
model ProcessedWebhook {
  id            String   @id @default(uuid())
  provider      String   // 'recall' | 'clerk' | 'stripe' | 'deepgram'
  eventId       String   @map("event_id")
  eventType     String   @map("event_type")
  processedAt   DateTime @default(now()) @map("processed_at")
  
  @@unique([provider, eventId])
  @@index([processedAt])
  @@map("processed_webhooks")
}
```

2. **Create idempotency utility** at `apps/api/src/utils/webhookIdempotency.ts`:
   - Export `async function checkAndMarkProcessed(provider: string, eventId: string, eventType: string): Promise<boolean>`
   - Returns `true` if this is the first time processing (proceed with handling)
   - Returns `false` if already processed (skip handling)
   - Use try/catch on unique constraint violation (Prisma error code P2002)
   - Log when duplicate is detected

3. **Update webhook handlers** to use idempotency check:
   - `apps/api/src/routes/webhooks/recall.ts` - Use `bot_id + event_type` as eventId
   - `apps/api/src/routes/webhooks/clerk.ts` - Use Svix event ID from headers
   - `apps/api/src/billing/routes.ts` (Stripe webhook) - Use Stripe event ID
   
4. **Create cleanup job** in the orphaned bot cleanup worker (Fix 4):
   - Delete ProcessedWebhook records older than 7 days
   - Run daily

### Acceptance Criteria
- [ ] ProcessedWebhook table created via migration
- [ ] Recall webhooks check idempotency before processing
- [ ] Clerk webhooks check idempotency before processing  
- [ ] Stripe webhooks check idempotency before processing
- [ ] Duplicate webhooks return 200 OK but don't reprocess
- [ ] Cleanup removes records older than 7 days

---

## Fix 2: Duplicate Bot Prevention

### Problem
Users can click "Start Recording" multiple times, or API calls can retry, creating multiple bots for the same meeting.

### Requirements

1. **Update `apps/api/src/services/recallService.ts`** - In the `createBot` method, add checks BEFORE calling Recall.ai API:

```typescript
async createBot(options: CreateBotOptions): Promise<RecallBot> {
  const { meetingId, meetingUrl, organizationId } = options;
  
  // Check 1: Existing active bot for this meeting record
  const existingBot = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      status: { in: ['joining', 'in_progress', 'recording'] },
      botId: { not: null },
    },
  });
  
  if (existingBot) {
    throw new ConflictError(
      'A recording is already in progress for this meeting. ' +
      'Please wait for it to complete or stop it first.'
    );
  }
  
  // Check 2: Active bot for same meeting URL (different meeting record)
  const duplicateUrl = await prisma.meeting.findFirst({
    where: {
      meetingUrl,
      organizationId,
      status: { in: ['joining', 'in_progress', 'recording'] },
      botId: { not: null },
      id: { not: meetingId },
    },
  });
  
  if (duplicateUrl) {
    throw new ConflictError(
      'This meeting URL is already being recorded in another session.'
    );
  }
  
  // Proceed with existing bot creation logic...
}
```

2. **Add ConflictError** to `packages/shared/src/errors/http.ts` if not exists:
```typescript
export class ConflictError extends HttpError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}
```

3. **Update controller** `apps/api/src/controllers/meetingController.ts`:
   - Catch ConflictError in startBot method
   - Return 409 status with clear error message

### Acceptance Criteria
- [ ] Cannot create bot if meeting already has active bot
- [ ] Cannot create bot if same URL already being recorded in org
- [ ] Returns 409 Conflict with helpful message
- [ ] Add test case for duplicate bot prevention

---

## Fix 3: Critical Database Transactions

### Problem
Multi-step operations don't use transactions, causing inconsistent state when partial failures occur.

### Requirements

1. **Update `apps/api/src/services/meetingService.ts`** - Wrap meeting creation with bot in transaction:

```typescript
async createWithBot(data: CreateMeetingWithBotInput): Promise<Meeting> {
  return prisma.$transaction(async (tx) => {
    // Create meeting record
    const meeting = await tx.meeting.create({
      data: {
        title: data.title,
        meetingUrl: data.meetingUrl,
        organizationId: data.organizationId,
        userId: data.userId,
        status: 'scheduled',
        source: data.source || 'manual',
      },
    });
    
    // If immediate recording requested, create bot
    if (data.startImmediately) {
      const bot = await recallService.createBot({
        meetingId: meeting.id,
        meetingUrl: data.meetingUrl,
        organizationId: data.organizationId,
      });
      
      // Update meeting with bot info (within transaction)
      return tx.meeting.update({
        where: { id: meeting.id },
        data: {
          botId: bot.id,
          status: 'joining',
        },
      });
    }
    
    return meeting;
  }, {
    timeout: 30000,
  });
}
```

2. **Update `apps/api/src/services/authService.ts`** - Wrap user+org creation in transaction for `handleUserCreated`:

```typescript
async handleUserCreated(event: ClerkUserCreatedEvent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Check/create organization
    let org = await tx.organization.findUnique({
      where: { clerkId: event.data.organization_id },
    });
    
    if (!org) {
      org = await tx.organization.create({
        data: {
          clerkId: event.data.organization_id,
          name: event.data.organization_name || 'My Organization',
          plan: 'free',
        },
      });
    }
    
    // Create user
    await tx.user.create({
      data: {
        clerkId: event.data.id,
        email: event.data.email_addresses[0]?.email_address,
        name: `${event.data.first_name || ''} ${event.data.last_name || ''}`.trim(),
        organizationId: org.id,
      },
    });
  });
}
```

3. **Update transcription processor** `services/transcription/src/processor.ts`:
   - Wrap transcript + meeting status update in transaction
   - If summary job queuing fails after transcript save, don't leave meeting in wrong state

### Acceptance Criteria
- [ ] Meeting + bot creation is atomic
- [ ] User + organization creation is atomic
- [ ] Transcript save + status update is atomic
- [ ] Partial failures rollback completely
- [ ] Add tests for transaction rollback scenarios

---

## Fix 4: Orphaned Bot Cleanup Worker

### Problem
Bots can get stuck in "joining" or "recording" state forever if Recall.ai has issues or webhooks fail to deliver.

### Requirements

1. **Create new worker** at `services/bot-cleanup/`:

```
services/bot-cleanup/
├── src/
│   ├── index.ts      # Worker entry point
│   └── cleanup.ts    # Cleanup logic
├── package.json
├── tsconfig.json
└── Dockerfile
```

2. **Implement cleanup logic** in `services/bot-cleanup/src/cleanup.ts`:

```typescript
import { prisma } from '@zigznote/database';
import { logger } from './logger';

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const WEBHOOK_CLEANUP_DAYS = 7;

export async function cleanupOrphanedBots(): Promise<{ cleaned: number }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  
  // Find stuck bots
  const staleMeetings = await prisma.meeting.findMany({
    where: {
      status: { in: ['joining', 'in_progress', 'recording'] },
      updatedAt: { lt: staleThreshold },
      botId: { not: null },
    },
    select: {
      id: true,
      botId: true,
      title: true,
      organizationId: true,
      userId: true,
    },
  });
  
  let cleaned = 0;
  
  for (const meeting of staleMeetings) {
    try {
      // Try to stop bot at Recall.ai (best effort)
      if (meeting.botId) {
        try {
          await recallService.stopBot(meeting.botId);
        } catch (e) {
          // Bot may already be gone, continue
          logger.debug({ botId: meeting.botId }, 'Bot already stopped or not found');
        }
      }
      
      // Mark meeting as failed
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'failed',
          metadata: {
            failureReason: 'bot_timeout',
            cleanedUpAt: new Date().toISOString(),
            originalBotId: meeting.botId,
          },
        },
      });
      
      // Queue notification email to user
      await emailQueue.add('meeting-failed', {
        type: 'meeting-failed',
        userId: meeting.userId,
        data: {
          meetingTitle: meeting.title,
          reason: 'The recording bot timed out. This can happen if the meeting ended unexpectedly or there was a technical issue.',
        },
      });
      
      cleaned++;
      logger.info({ meetingId: meeting.id, botId: meeting.botId }, 'Cleaned up orphaned bot');
      
    } catch (error) {
      logger.error({ meetingId: meeting.id, error }, 'Failed to cleanup orphaned bot');
    }
  }
  
  return { cleaned };
}

export async function cleanupOldWebhooks(): Promise<{ deleted: number }> {
  const threshold = new Date(Date.now() - WEBHOOK_CLEANUP_DAYS * 24 * 60 * 60 * 1000);
  
  const result = await prisma.processedWebhook.deleteMany({
    where: {
      processedAt: { lt: threshold },
    },
  });
  
  logger.info({ deleted: result.count }, 'Cleaned up old webhook records');
  return { deleted: result.count };
}
```

3. **Create worker entry** in `services/bot-cleanup/src/index.ts`:

```typescript
import cron from 'node-cron';
import { cleanupOrphanedBots, cleanupOldWebhooks } from './cleanup';
import { logger } from './logger';

// Run bot cleanup every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  logger.info('Starting orphaned bot cleanup');
  try {
    const result = await cleanupOrphanedBots();
    logger.info({ cleaned: result.cleaned }, 'Orphaned bot cleanup complete');
  } catch (error) {
    logger.error({ error }, 'Orphaned bot cleanup failed');
  }
});

// Run webhook cleanup daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  logger.info('Starting webhook cleanup');
  try {
    const result = await cleanupOldWebhooks();
    logger.info({ deleted: result.deleted }, 'Webhook cleanup complete');
  } catch (error) {
    logger.error({ error }, 'Webhook cleanup failed');
  }
});

logger.info('Bot cleanup worker started');
```

4. **Add to docker-compose.yml**:
```yaml
bot-cleanup:
  build:
    context: .
    dockerfile: services/bot-cleanup/Dockerfile
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - REDIS_URL=${REDIS_URL}
  depends_on:
    - postgres
    - redis
```

5. **Add to turbo.json** build pipeline

### Acceptance Criteria
- [ ] Worker runs every 5 minutes
- [ ] Meetings stuck > 2 hours marked as failed
- [ ] Bot stop attempted at Recall.ai (best effort)
- [ ] User notified via email about failed recording
- [ ] Webhook records cleaned up after 7 days
- [ ] Worker has proper logging and error handling
- [ ] Dockerfile and docker-compose entry added

---

## Fix 5: Storage Cleanup Worker

### Problem
When meetings are soft-deleted, audio files remain in S3 forever, causing unbounded storage costs.

### Requirements

1. **Add to bot-cleanup worker** (same service, new function) in `services/bot-cleanup/src/cleanup.ts`:

```typescript
const STORAGE_CLEANUP_DAYS = 30; // Days after soft-delete to remove files

export async function cleanupOrphanedStorage(): Promise<{ deleted: number; bytesFreed: number }> {
  const threshold = new Date(Date.now() - STORAGE_CLEANUP_DAYS * 24 * 60 * 60 * 1000);
  
  // Find soft-deleted meetings with audio files
  const deletedMeetings = await prisma.meeting.findMany({
    where: {
      deletedAt: { 
        not: null,
        lt: threshold, // Deleted more than 30 days ago
      },
      audioFileUrl: { not: null },
    },
    select: {
      id: true,
      audioFileUrl: true,
      audioFileSize: true,
    },
  });
  
  let deleted = 0;
  let bytesFreed = 0;
  
  for (const meeting of deletedMeetings) {
    try {
      // Delete from S3
      if (meeting.audioFileUrl) {
        await storageService.deleteFile(meeting.audioFileUrl);
        bytesFreed += meeting.audioFileSize || 0;
      }
      
      // Clear the URL in database
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          audioFileUrl: null,
          audioFileName: null,
          audioFileSize: null,
        },
      });
      
      deleted++;
      
    } catch (error) {
      logger.error({ meetingId: meeting.id, error }, 'Failed to delete audio file');
    }
  }
  
  logger.info({ deleted, bytesFreed, bytesFreedMB: (bytesFreed / 1024 / 1024).toFixed(2) }, 'Storage cleanup complete');
  return { deleted, bytesFreed };
}
```

2. **Add to cron schedule** in `services/bot-cleanup/src/index.ts`:

```typescript
// Run storage cleanup daily at 4 AM
cron.schedule('0 4 * * *', async () => {
  logger.info('Starting storage cleanup');
  try {
    const result = await cleanupOrphanedStorage();
    logger.info(result, 'Storage cleanup complete');
  } catch (error) {
    logger.error({ error }, 'Storage cleanup failed');
  }
});
```

3. **Ensure storageService.deleteFile exists** in `apps/api/src/services/storageService.ts`:
   - Should handle S3 DeleteObject
   - Should not throw if file doesn't exist (idempotent)

### Acceptance Criteria
- [ ] Runs daily at 4 AM
- [ ] Only deletes files for meetings soft-deleted > 30 days
- [ ] S3 files actually deleted (verify in tests)
- [ ] Database cleared of audio URL after deletion
- [ ] Logs bytes freed for monitoring
- [ ] Handles missing files gracefully

---

## Fix 6: API Key Brute Force Protection

### Problem
API key validation has no rate limiting, allowing attackers to enumerate valid keys.

### Requirements

1. **Update `apps/api/src/middleware/apiKeyAuth.ts`**:

```typescript
import { TooManyRequestsError } from '@zigznote/shared';

// In-memory store for failed attempts (use Redis in production for multi-instance)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

const LOCKOUT_THRESHOLD = 10; // Failed attempts before lockout
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of failedAttempts.entries()) {
    if (now - value.firstAttempt > LOCKOUT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

function checkBruteForce(ip: string, keyPrefix: string): void {
  const lockoutKey = `${ip}:${keyPrefix.slice(0, 8)}`;
  const attempts = failedAttempts.get(lockoutKey);
  
  if (attempts && attempts.count >= LOCKOUT_THRESHOLD) {
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    if (timeSinceFirst < LOCKOUT_WINDOW_MS) {
      const remainingSeconds = Math.ceil((LOCKOUT_WINDOW_MS - timeSinceFirst) / 1000);
      throw new TooManyRequestsError(
        `Too many failed API key attempts. Try again in ${remainingSeconds} seconds.`
      );
    }
    // Window expired, reset
    failedAttempts.delete(lockoutKey);
  }
}

function recordFailedAttempt(ip: string, keyPrefix: string): void {
  const lockoutKey = `${ip}:${keyPrefix.slice(0, 8)}`;
  const attempts = failedAttempts.get(lockoutKey);
  
  if (attempts) {
    attempts.count++;
  } else {
    failedAttempts.set(lockoutKey, { count: 1, firstAttempt: Date.now() });
  }
  
  // Log security event if approaching lockout
  const current = failedAttempts.get(lockoutKey)!;
  if (current.count === LOCKOUT_THRESHOLD) {
    logger.warn({ ip, keyPrefix: keyPrefix.slice(0, 8), attempts: current.count }, 
      'API key brute force lockout triggered');
    
    // Could add: await auditService.logSecurityEvent(...)
  }
}

// In the main auth middleware function:
export const apiKeyAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer sk_')) {
    return next(); // Not an API key, try other auth
  }
  
  const apiKey = authHeader.slice(7); // Remove 'Bearer '
  const keyPrefix = apiKey.slice(0, 20); // First 20 chars for lookup
  const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
  
  try {
    // Check if IP is locked out
    checkBruteForce(ip, keyPrefix);
    
    // Validate key
    const result = await apiKeyService.validateAndGetUser(apiKey);
    
    if (!result) {
      recordFailedAttempt(ip, keyPrefix);
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
      });
    }
    
    // Success - attach auth to request
    (req as AuthenticatedRequest).auth = result;
    next();
    
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: error.message },
      });
    }
    next(error);
  }
};
```

2. **Add TooManyRequestsError** to `packages/shared/src/errors/http.ts` if not exists:
```typescript
export class TooManyRequestsError extends HttpError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}
```

### Acceptance Criteria
- [ ] 10 failed attempts from same IP triggers 15-minute lockout
- [ ] Lockout is per IP + key prefix combination
- [ ] Security warning logged on lockout
- [ ] Returns 429 with helpful message
- [ ] Old entries cleaned up to prevent memory leak
- [ ] Add test for brute force protection

---

## Fix 7: Payment Grace Period

### Problem
When payment fails, users lose access immediately with no opportunity to fix payment method.

### Requirements

1. **Add fields to Subscription model** in `packages/database/prisma/schema.prisma`:

```prisma
model Subscription {
  // ... existing fields
  
  graceEndsAt       DateTime? @map("grace_ends_at")
  paymentFailedAt   DateTime? @map("payment_failed_at")
  paymentRetryCount Int       @default(0) @map("payment_retry_count")
  
  // ... rest of model
}
```

2. **Update BillingService** in `apps/api/src/billing/BillingService.ts`:

```typescript
const GRACE_PERIOD_DAYS = 7;
const MAX_RETRY_COUNT = 4;

async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  const subscription = await this.getSubscriptionByProviderId(event.subscriptionId);
  if (!subscription) return;
  
  const retryCount = (subscription.paymentRetryCount || 0) + 1;
  
  // Calculate grace period end (only set on first failure)
  const graceEndsAt = subscription.graceEndsAt || 
    new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'past_due',
      graceEndsAt,
      paymentFailedAt: new Date(),
      paymentRetryCount: retryCount,
    },
  });
  
  // Send appropriate dunning email based on retry count
  const emailType = retryCount === 1 ? 'payment-failed-first' :
                    retryCount === 2 ? 'payment-failed-second' :
                    retryCount >= 3 ? 'payment-failed-final' : 'payment-failed';
  
  await emailQueue.add(emailType, {
    userId: subscription.userId,
    data: {
      retryCount,
      graceEndsAt: graceEndsAt.toLocaleDateString(),
      updatePaymentUrl: `${config.webUrl}/settings/billing`,
    },
  });
  
  logger.info({ subscriptionId: subscription.id, retryCount, graceEndsAt }, 
    'Payment failed, grace period active');
}

async handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
  const subscription = await this.getSubscriptionByProviderId(event.subscriptionId);
  if (!subscription) return;
  
  // Clear grace period on successful payment
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'active',
      graceEndsAt: null,
      paymentFailedAt: null,
      paymentRetryCount: 0,
    },
  });
  
  logger.info({ subscriptionId: subscription.id }, 'Payment succeeded, grace period cleared');
}
```

3. **Add grace period check job** to bot-cleanup worker:

```typescript
// Run every hour
cron.schedule('0 * * * *', async () => {
  await checkExpiredGracePeriods();
});

async function checkExpiredGracePeriods(): Promise<void> {
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'past_due',
      graceEndsAt: { lt: new Date() },
    },
    include: {
      organization: true,
    },
  });
  
  for (const subscription of expiredSubscriptions) {
    // Suspend the subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'suspended' },
    });
    
    // Notify user
    await emailQueue.add('subscription-suspended', {
      organizationId: subscription.organizationId,
      data: {
        organizationName: subscription.organization.name,
        reactivateUrl: `${config.webUrl}/settings/billing`,
      },
    });
    
    logger.info({ subscriptionId: subscription.id }, 'Subscription suspended after grace period');
  }
}
```

4. **Update quota enforcement** to allow read access during grace period:

```typescript
// In quotaService.ts
async checkQuota(organizationId: string, action: QuotaAction): Promise<QuotaResult> {
  const subscription = await this.getActiveSubscription(organizationId);
  
  // If suspended (past grace period), block everything
  if (subscription?.status === 'suspended') {
    return {
      allowed: false,
      reason: 'Your subscription is suspended. Please update your payment method.',
    };
  }
  
  // If past_due (in grace period), allow reads but block writes
  if (subscription?.status === 'past_due') {
    const readActions = ['view_meeting', 'view_transcript', 'search'];
    if (!readActions.includes(action)) {
      return {
        allowed: false,
        reason: 'Your payment is past due. Please update your payment method to continue creating content.',
        gracePeriod: true,
        graceEndsAt: subscription.graceEndsAt,
      };
    }
  }
  
  // Normal quota checks...
}
```

### Acceptance Criteria
- [ ] 7-day grace period on first payment failure
- [ ] Dunning emails sent (1st, 2nd, final warning)
- [ ] Users can view data during grace period
- [ ] Users cannot create new meetings during grace period
- [ ] Subscription suspended after grace period expires
- [ ] Successful payment clears grace period
- [ ] Add tests for grace period flow

---

## Fix 8: Plan Downgrade Handling

### Problem
When users downgrade from Pro to Free, they may have more data than the Free plan allows. Currently no logic handles this.

### Requirements

1. **Add fields to Organization model** in `packages/database/prisma/schema.prisma`:

```prisma
model Organization {
  // ... existing fields
  
  planViolations    Json?     @map("plan_violations")
  planViolationsAt  DateTime? @map("plan_violations_at")
  
  // ... rest of model
}
```

2. **Create plan change handler** in `apps/api/src/billing/BillingService.ts`:

```typescript
interface PlanViolation {
  type: 'meetings' | 'storage' | 'team_members';
  current: number;
  limit: number;
  action: 'read_only' | 'notify_admin' | 'grace_period';
  graceEndsAt?: Date;
}

async handlePlanChange(
  organizationId: string,
  oldPlanId: string,
  newPlanId: string
): Promise<{ violations: PlanViolation[] }> {
  const newLimits = PLAN_LIMITS[newPlanId];
  const usage = await quotaService.getUsage(organizationId);
  
  const violations: PlanViolation[] = [];
  
  // Check meetings (allow viewing, not creating)
  if (newLimits.meetingsPerMonth !== -1 && 
      usage.meetingsThisMonth > newLimits.meetingsPerMonth) {
    violations.push({
      type: 'meetings',
      current: usage.meetingsThisMonth,
      limit: newLimits.meetingsPerMonth,
      action: 'read_only',
    });
  }
  
  // Check team members (admin must remove)
  if (newLimits.teamMembers !== -1 && 
      usage.teamMemberCount > newLimits.teamMembers) {
    violations.push({
      type: 'team_members',
      current: usage.teamMemberCount,
      limit: newLimits.teamMembers,
      action: 'notify_admin',
    });
  }
  
  // Check storage (30-day grace to reduce)
  if (usage.storageUsedGb > newLimits.storageGb) {
    violations.push({
      type: 'storage',
      current: Math.round(usage.storageUsedGb * 100) / 100,
      limit: newLimits.storageGb,
      action: 'grace_period',
      graceEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }
  
  if (violations.length > 0) {
    // Store violations
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        planViolations: violations,
        planViolationsAt: new Date(),
      },
    });
    
    // Notify admin
    await emailQueue.add('plan-downgrade-violations', {
      organizationId,
      data: { violations },
    });
    
    logger.info({ organizationId, violations }, 'Plan downgrade violations detected');
  }
  
  return { violations };
}
```

3. **Update quota enforcement** to check violations:

```typescript
// In quotaService.ts
async enforceQuota(organizationId: string, action: QuotaAction): Promise<void> {
  // Check for plan violations first
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { planViolations: true },
  });
  
  const violations = org?.planViolations as PlanViolation[] | null;
  
  if (violations?.length) {
    for (const violation of violations) {
      // Block new meetings if over limit
      if (violation.type === 'meetings' && action === 'create_meeting') {
        throw new ForbiddenError(
          `You've reached your plan limit of ${violation.limit} meetings this month. ` +
          `Please upgrade to create more meetings.`
        );
      }
      
      // Block adding members if over limit
      if (violation.type === 'team_members' && action === 'add_member') {
        throw new ForbiddenError(
          `Your team has ${violation.current} members but your plan allows ${violation.limit}. ` +
          `Please remove team members or upgrade your plan.`
        );
      }
      
      // Block uploads if storage grace period expired
      if (violation.type === 'storage' && 
          violation.graceEndsAt && 
          new Date(violation.graceEndsAt) < new Date() &&
          action === 'upload_audio') {
        throw new ForbiddenError(
          `Your storage (${violation.current}GB) exceeds your plan limit (${violation.limit}GB). ` +
          `Please delete old meetings or upgrade your plan.`
        );
      }
    }
  }
  
  // Continue with normal quota checks...
}
```

4. **Add violation check job** to cleanup worker:

```typescript
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await checkStorageGracePeriods();
});

async function checkStorageGracePeriods(): Promise<void> {
  // Find orgs with expired storage grace periods
  const orgs = await prisma.organization.findMany({
    where: {
      planViolations: { not: null },
    },
  });
  
  for (const org of orgs) {
    const violations = org.planViolations as PlanViolation[];
    const storageViolation = violations.find(v => 
      v.type === 'storage' && 
      v.graceEndsAt && 
      new Date(v.graceEndsAt) < new Date()
    );
    
    if (storageViolation) {
      // Send final warning
      await emailQueue.add('storage-grace-expired', {
        organizationId: org.id,
        data: {
          currentGb: storageViolation.current,
          limitGb: storageViolation.limit,
        },
      });
    }
  }
}
```

5. **Clear violations on upgrade**:

```typescript
// When plan changes to higher tier
if (isUpgrade(oldPlanId, newPlanId)) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planViolations: null,
      planViolationsAt: null,
    },
  });
}
```

### Acceptance Criteria
- [ ] Violations detected on plan downgrade
- [ ] Users can view all data regardless of violations
- [ ] New meeting creation blocked if over limit
- [ ] New member addition blocked if over limit
- [ ] 30-day grace period for storage violations
- [ ] Admin notified of violations via email
- [ ] Violations cleared on upgrade
- [ ] Add tests for downgrade scenarios

---

## Testing Requirements

Create test file `apps/api/tests/critical-fixes.test.ts`:

```typescript
describe('Critical Infrastructure Fixes', () => {
  describe('Webhook Idempotency', () => {
    it('should process webhook first time');
    it('should skip duplicate webhook');
    it('should handle different event types separately');
  });
  
  describe('Duplicate Bot Prevention', () => {
    it('should reject bot creation if already active');
    it('should reject bot creation if same URL in progress');
    it('should allow bot creation after previous completed');
  });
  
  describe('Transactions', () => {
    it('should rollback meeting if bot creation fails');
    it('should rollback user if org creation fails');
  });
  
  describe('API Key Brute Force', () => {
    it('should allow valid key');
    it('should reject invalid key');
    it('should lockout after 10 failed attempts');
    it('should reset lockout after 15 minutes');
  });
  
  describe('Grace Period', () => {
    it('should set 7-day grace on payment failure');
    it('should allow reads during grace period');
    it('should block writes during grace period');
    it('should suspend after grace expires');
    it('should clear grace on successful payment');
  });
  
  describe('Plan Downgrade', () => {
    it('should detect meeting limit violation');
    it('should detect storage violation');
    it('should detect team member violation');
    it('should allow viewing over-limit data');
    it('should block new creation when over limit');
    it('should clear violations on upgrade');
  });
});
```

---

## Migration Checklist

Run after all code changes:

```bash
# 1. Generate Prisma migration
cd packages/database
npx prisma migrate dev --name add_critical_fixes

# 2. Update Prisma client
npx prisma generate

# 3. Run all tests
cd ../..
pnpm test

# 4. Build all packages
pnpm build

# 5. Start cleanup worker locally to test
cd services/bot-cleanup
pnpm dev
```

---

## Deployment Order

1. Deploy database migration first
2. Deploy API with all fixes
3. Deploy bot-cleanup worker
4. Verify cleanup job runs successfully
5. Monitor logs for any issues

---

## Success Metrics

After deployment, verify:

- [ ] No duplicate webhooks processed (check logs)
- [ ] No duplicate bots created (check Recall.ai dashboard)
- [ ] Orphaned bots cleaned up within 2 hours
- [ ] Storage decreasing for deleted meetings
- [ ] No 401s from valid API keys
- [ ] Grace period emails sending correctly
- [ ] Downgrade violations detected correctly

---

## Files to Create/Modify Summary

### New Files
- `apps/api/src/utils/webhookIdempotency.ts`
- `services/bot-cleanup/src/index.ts`
- `services/bot-cleanup/src/cleanup.ts`
- `services/bot-cleanup/src/logger.ts`
- `services/bot-cleanup/package.json`
- `services/bot-cleanup/tsconfig.json`
- `services/bot-cleanup/Dockerfile`
- `apps/api/tests/critical-fixes.test.ts`

### Modified Files
- `packages/database/prisma/schema.prisma` (add 4 fields + 1 model)
- `apps/api/src/services/recallService.ts` (add duplicate check)
- `apps/api/src/services/meetingService.ts` (add transaction)
- `apps/api/src/services/authService.ts` (add transaction)
- `apps/api/src/middleware/apiKeyAuth.ts` (add brute force protection)
- `apps/api/src/billing/BillingService.ts` (add grace period + downgrade)
- `apps/api/src/services/quotaService.ts` (add violation checks)
- `apps/api/src/routes/webhooks/recall.ts` (add idempotency)
- `apps/api/src/routes/webhooks/clerk.ts` (add idempotency)
- `apps/api/src/billing/routes.ts` (add idempotency)
- `packages/shared/src/errors/http.ts` (add ConflictError, TooManyRequestsError)
- `docker-compose.yml` (add bot-cleanup service)
- `turbo.json` (add bot-cleanup to pipeline)
