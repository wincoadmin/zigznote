/**
 * Webhook Idempotency Utility
 *
 * Prevents duplicate processing of webhooks from external providers.
 * Uses database to track processed events with unique constraint.
 */

import { prisma, Prisma } from '@zigznote/database';
import { logger } from './logger';

export type WebhookProvider = 'recall' | 'clerk' | 'stripe' | 'deepgram' | 'flutterwave';

/**
 * Check if a webhook event has already been processed.
 * If not, mark it as processed and return true.
 * If already processed, return false.
 *
 * @param provider - The webhook provider (recall, clerk, stripe, etc.)
 * @param eventId - Unique event identifier from the provider
 * @param eventType - The type of event (for logging)
 * @returns true if this is the first time processing (proceed), false if duplicate (skip)
 */
export async function checkAndMarkProcessed(
  provider: WebhookProvider,
  eventId: string,
  eventType: string
): Promise<boolean> {
  try {
    // Try to create a record - if it already exists, unique constraint will fail
    await prisma.processedWebhook.create({
      data: {
        provider,
        eventId,
        eventType,
      },
    });

    logger.debug({ provider, eventId, eventType }, 'Webhook marked as processed');
    return true;
  } catch (err) {
    // Check for unique constraint violation (Prisma error code P2002)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      logger.info(
        { provider, eventId, eventType },
        'Duplicate webhook detected, skipping processing'
      );
      return false;
    }

    // Re-throw unexpected errors
    logger.error({ provider, eventId, eventType, error: err }, 'Error checking webhook idempotency');
    throw err;
  }
}

/**
 * Check if a webhook event has been processed (without marking it).
 * Useful for read-only checks.
 *
 * @param provider - The webhook provider
 * @param eventId - Unique event identifier
 * @returns true if already processed, false if not
 */
export async function isProcessed(
  provider: WebhookProvider,
  eventId: string
): Promise<boolean> {
  const existing = await prisma.processedWebhook.findUnique({
    where: {
      provider_eventId: {
        provider,
        eventId,
      },
    },
  });

  return existing !== null;
}

/**
 * Delete old webhook records for cleanup.
 * Called by cleanup worker to prevent unbounded table growth.
 *
 * @param daysOld - Delete records older than this many days
 * @returns Number of records deleted
 */
export async function cleanupOldWebhooks(daysOld: number = 7): Promise<number> {
  const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await prisma.processedWebhook.deleteMany({
    where: {
      processedAt: { lt: threshold },
    },
  });

  logger.info(
    { deleted: result.count, daysOld },
    'Cleaned up old webhook records'
  );

  return result.count;
}
