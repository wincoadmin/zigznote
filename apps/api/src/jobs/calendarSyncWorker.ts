/**
 * Calendar sync worker
 * Processes calendar sync jobs from the queue
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, getCalendarSyncQueue } from './queues';
import { googleCalendarService } from '../services/googleCalendarService';
import { calendarRepository } from '@zigznote/database';
import { logger } from '../utils/logger';
import { QUEUE_NAMES, type CalendarSyncJobData } from '@zigznote/shared';

/**
 * Process a single calendar sync job
 */
async function processCalendarSyncJob(
  job: Job<CalendarSyncJobData>
): Promise<{ synced: number; created: number; updated: number; errors: number }> {
  const { connectionId, organizationId, userId, syncType } = job.data;

  logger.info(
    { jobId: job.id, connectionId, syncType },
    'Processing calendar sync job'
  );

  if (syncType === 'single' && connectionId && organizationId) {
    // Sync a single connection
    const result = await googleCalendarService.syncCalendar(
      connectionId,
      organizationId
    );

    logger.info(
      { jobId: job.id, connectionId, result },
      'Calendar sync completed'
    );

    return result;
  }

  if (syncType === 'user' && userId) {
    // Sync all connections for a user
    const connections = await calendarRepository.findByUserId(userId);
    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };

    for (const connection of connections) {
      if (!connection.syncEnabled) continue;

      try {
        // Get the user's organization ID from the connection
        const result = await googleCalendarService.syncCalendar(
          connection.id,
          organizationId || ''
        );
        results.synced += result.synced;
        results.created += result.created;
        results.updated += result.updated;
        results.errors += result.errors;
      } catch (error) {
        logger.error(
          { error, connectionId: connection.id },
          'Failed to sync calendar connection'
        );
        results.errors++;
      }
    }

    return results;
  }

  if (syncType === 'all') {
    // Sync all stale connections (scheduled job)
    const staleConnections = await calendarRepository.findStaleConnections(15);
    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };

    logger.info(
      { count: staleConnections.length },
      'Found stale calendar connections to sync'
    );

    for (const connection of staleConnections) {
      try {
        // For scheduled syncs, we need to find the org for each user
        const result = await googleCalendarService.syncCalendar(
          connection.id,
          organizationId || ''
        );
        results.synced += result.synced;
        results.created += result.created;
        results.updated += result.updated;
        results.errors += result.errors;
      } catch (error) {
        logger.error(
          { error, connectionId: connection.id },
          'Failed to sync calendar connection'
        );
        results.errors++;
      }
    }

    return results;
  }

  throw new Error(`Invalid sync type: ${syncType}`);
}

/**
 * Creates and starts the calendar sync worker
 */
export function createCalendarSyncWorker(): Worker<CalendarSyncJobData> {
  const worker = new Worker<CalendarSyncJobData>(
    QUEUE_NAMES.CALENDAR_SYNC,
    processCalendarSyncJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // 10 jobs per second max
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, returnValue: job.returnvalue },
      'Calendar sync job completed'
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error },
      'Calendar sync job failed'
    );
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'Calendar sync worker error');
  });

  logger.info('Calendar sync worker started');

  return worker;
}

/**
 * Schedules periodic calendar sync for all connections
 * Called from the main server to set up recurring sync
 */
export async function schedulePeriodicCalendarSync(): Promise<void> {
  const queue = getCalendarSyncQueue();

  // Remove any existing repeatable job
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'periodic-sync') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add a new repeatable job that runs every 15 minutes
  await queue.add(
    'periodic-sync',
    {
      syncType: 'all',
    },
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      jobId: 'periodic-calendar-sync',
    }
  );

  logger.info('Scheduled periodic calendar sync every 15 minutes');
}
