/**
 * @ownership
 * @domain System Cleanup
 * @description Scheduled worker for orphaned bots, webhook records, storage, and grace periods
 * @single-responsibility YES — handles all system cleanup operations
 * @last-reviewed 2026-01-06
 */

import cron from 'node-cron';
import { prisma, Prisma } from '@zigznote/database';
import { logger } from '../utils/logger';
import { recallService } from '../services/recallService';
import { cleanupOldWebhooks } from '../utils/webhookIdempotency';

// Configuration
const STALE_BOT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const STORAGE_CLEANUP_DAYS = 30; // Days after soft-delete to remove files

/**
 * Cleanup orphaned bots that are stuck in active states
 */
export async function cleanupOrphanedBots(): Promise<{ cleaned: number }> {
  const staleThreshold = new Date(Date.now() - STALE_BOT_THRESHOLD_MS);

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

      cleaned++;
      logger.info({ meetingId: meeting.id, botId: meeting.botId }, 'Cleaned up orphaned bot');
    } catch (error) {
      logger.error({ meetingId: meeting.id, error }, 'Failed to cleanup orphaned bot');
    }
  }

  return { cleaned };
}

/**
 * Cleanup orphaned storage for soft-deleted meetings
 */
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
      // Clear the URL in database (storage deletion would happen via S3 lifecycle policy or manual deletion)
      // In production, integrate with storageService.deleteFile here
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          audioFileUrl: null,
          audioFileName: null,
          audioFileSize: null,
        },
      });

      bytesFreed += meeting.audioFileSize || 0;
      deleted++;
    } catch (error) {
      logger.error({ meetingId: meeting.id, error }, 'Failed to cleanup audio file reference');
    }
  }

  logger.info(
    { deleted, bytesFreed, bytesFreedMB: (bytesFreed / 1024 / 1024).toFixed(2) },
    'Storage cleanup complete'
  );

  return { deleted, bytesFreed };
}

/**
 * Check and handle expired grace periods
 */
export async function checkExpiredGracePeriods(): Promise<{ suspended: number }> {
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'past_due',
      graceEndsAt: { lt: new Date() },
    },
    include: {
      customer: {
        include: {
          organization: true,
        },
      },
    },
  });

  let suspended = 0;

  for (const subscription of expiredSubscriptions) {
    try {
      // Suspend the subscription
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'suspended' },
      });

      suspended++;
      logger.info(
        { subscriptionId: subscription.id, organizationId: subscription.customer?.organizationId },
        'Subscription suspended after grace period expired'
      );
    } catch (error) {
      logger.error({ subscriptionId: subscription.id, error }, 'Failed to suspend subscription');
    }
  }

  return { suspended };
}

/**
 * Check storage grace periods for plan violations
 */
export async function checkStorageGracePeriods(): Promise<{ notified: number }> {
  interface PlanViolation {
    type: 'meetings' | 'storage' | 'team_members';
    current: number;
    limit: number;
    action: 'read_only' | 'notify_admin' | 'grace_period';
    graceEndsAt?: string;
  }

  // Find orgs with expired storage grace periods
  const orgs = await prisma.organization.findMany({
    where: {
      planViolations: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      name: true,
      planViolations: true,
    },
  });

  let notified = 0;

  for (const org of orgs) {
    const violations = org.planViolations as PlanViolation[] | null;
    if (!violations) continue;

    const storageViolation = violations.find(
      (v) =>
        v.type === 'storage' &&
        v.graceEndsAt &&
        new Date(v.graceEndsAt) < new Date()
    );

    if (storageViolation) {
      logger.warn(
        { organizationId: org.id, currentGb: storageViolation.current, limitGb: storageViolation.limit },
        'Organization storage grace period expired'
      );
      notified++;
    }
  }

  return { notified };
}

/**
 * Start the cleanup worker with scheduled tasks
 */
export function startCleanupWorker(): void {
  logger.info('Starting cleanup worker');

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
      const deleted = await cleanupOldWebhooks(7);
      logger.info({ deleted }, 'Webhook cleanup complete');
    } catch (error) {
      logger.error({ error }, 'Webhook cleanup failed');
    }
  });

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

  // Check grace periods every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Checking expired grace periods');
    try {
      const graceResult = await checkExpiredGracePeriods();
      const storageResult = await checkStorageGracePeriods();
      logger.info({ suspended: graceResult.suspended, storageNotified: storageResult.notified }, 'Grace period check complete');
    } catch (error) {
      logger.error({ error }, 'Grace period check failed');
    }
  });

  logger.info('Cleanup worker scheduled tasks started');
}
