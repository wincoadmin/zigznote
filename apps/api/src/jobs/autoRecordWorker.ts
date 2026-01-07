/**
 * Auto-record worker
 * Automatically deploys bots to meetings from calendars with auto-record enabled
 * Runs every 5 minutes
 */

import { Worker, Job, Queue } from 'bullmq';
import { getBullMQConnection } from './queues';
import { googleCalendarService } from '../services/googleCalendarService';
import { recallService } from '../services/recallService';
import { calendarRepository, meetingRepository, prisma } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Auto-record job data
 */
export interface AutoRecordJobData {
  type: 'check';
}

// Queue name
const QUEUE_NAME = 'auto-record';

// Queue instance
let autoRecordQueue: Queue<AutoRecordJobData> | null = null;

/**
 * Gets or creates the auto-record queue
 */
export function getAutoRecordQueue(): Queue<AutoRecordJobData> {
  if (!autoRecordQueue) {
    autoRecordQueue = new Queue<AutoRecordJobData>(QUEUE_NAME, {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 100,
      },
    });
  }
  return autoRecordQueue;
}

/**
 * Process auto-record check job
 * Finds connections with autoRecord enabled and deploys bots to upcoming meetings
 */
async function processAutoRecordJob(
  job: Job<AutoRecordJobData>
): Promise<{ processed: number; botsDeployed: number; errors: number }> {
  logger.info({ jobId: job.id }, 'Processing auto-record check');

  const result = {
    processed: 0,
    botsDeployed: 0,
    errors: 0,
  };

  try {
    // Find all connections with auto-record enabled
    const connections = await calendarRepository.findAutoRecordConnections();

    logger.info(
      { connectionCount: connections.length },
      'Found auto-record enabled connections'
    );

    for (const connection of connections) {
      if (!connection.user.organizationId) {
        logger.warn(
          { connectionId: connection.id },
          'Skipping connection - user has no organization'
        );
        continue;
      }

      try {
        result.processed++;

        // Get events starting in the next 10 minutes
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        // Look slightly into the past too (2 minutes) to catch meetings that just started
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

        const events = await googleCalendarService.listEvents(
          connection.id,
          twoMinutesAgo,
          tenMinutesFromNow
        );

        logger.debug(
          { connectionId: connection.id, eventCount: events.length },
          'Found upcoming events for auto-record'
        );

        for (const event of events) {
          // Skip events without meeting links
          if (!event.meetingLink) {
            continue;
          }

          try {
            // Check if a bot has already been deployed for this event
            const existingMeeting = await meetingRepository.findMany({
              calendarEventId: event.id,
            });

            // Skip if there's already a meeting with a bot for this event
            if (existingMeeting.length > 0) {
              const meeting = existingMeeting[0];
              if (
                meeting &&
                (meeting.botId || meeting.status === 'scheduled')
              ) {
                logger.debug(
                  { eventId: event.id, meetingId: meeting.id },
                  'Bot already deployed for this event'
                );
                continue;
              }
            }

            // Check if there's already an active bot for this meeting URL in this org
            const duplicateBot = await prisma.meeting.findFirst({
              where: {
                meetingUrl: event.meetingLink,
                organizationId: connection.user.organizationId,
                status: { in: ['scheduled', 'joining', 'in_progress', 'recording'] },
                botId: { not: null },
              },
            });

            if (duplicateBot) {
              logger.debug(
                { meetingUrl: event.meetingLink },
                'Bot already active for this meeting URL'
              );
              continue;
            }

            // Create meeting record if it doesn't exist
            let meeting = existingMeeting[0];

            if (!meeting) {
              meeting = await meetingRepository.create({
                organizationId: connection.user.organizationId,
                createdById: connection.userId,
                title: event.summary,
                platform: event.platform,
                meetingUrl: event.meetingLink,
                startTime: event.start,
                endTime: event.end,
                calendarEventId: event.id,
                status: 'scheduled',
              });

              logger.info(
                { meetingId: meeting.id, eventId: event.id },
                'Created meeting record for auto-record'
              );
            }

            // Calculate join time - join 1 minute before meeting starts (or now if already started)
            const joinTime = event.start > now
              ? new Date(event.start.getTime() - 60 * 1000) // 1 minute before
              : undefined; // Join immediately if already started

            // Deploy bot
            const botStatus = await recallService.createBot({
              meetingId: meeting.id,
              meetingUrl: event.meetingLink,
              organizationId: connection.user.organizationId,
              joinAt: joinTime,
            });

            // Update meeting with bot ID
            await meetingRepository.update(meeting.id, {
              botId: botStatus.id,
              status: 'scheduled',
            });

            result.botsDeployed++;

            logger.info(
              {
                meetingId: meeting.id,
                botId: botStatus.id,
                eventTitle: event.summary,
                joinTime,
              },
              'Auto-record bot deployed'
            );
          } catch (eventError) {
            logger.error(
              { error: eventError, eventId: event.id },
              'Failed to deploy auto-record bot for event'
            );
            result.errors++;
          }
        }
      } catch (connectionError) {
        logger.error(
          { error: connectionError, connectionId: connection.id },
          'Failed to process connection for auto-record'
        );
        result.errors++;
      }
    }
  } catch (error) {
    logger.error({ error }, 'Auto-record job failed');
    throw error;
  }

  logger.info(
    { result },
    'Auto-record check completed'
  );

  return result;
}

/**
 * Creates and starts the auto-record worker
 */
export function createAutoRecordWorker(): Worker<AutoRecordJobData> {
  const worker = new Worker<AutoRecordJobData>(
    QUEUE_NAME,
    processAutoRecordJob,
    {
      connection: getBullMQConnection(),
      concurrency: 1, // Only one job at a time to prevent duplicates
    }
  );

  worker.on('completed', (job, returnValue) => {
    logger.info(
      { jobId: job.id, result: returnValue },
      'Auto-record job completed'
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error },
      'Auto-record job failed'
    );
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'Auto-record worker error');
  });

  logger.info('Auto-record worker started');

  return worker;
}

/**
 * Schedules periodic auto-record checks
 * Called from the main server to set up recurring checks
 */
export async function scheduleAutoRecordChecks(): Promise<void> {
  const queue = getAutoRecordQueue();

  // Remove any existing repeatable job
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'auto-record-check') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add a new repeatable job that runs every 5 minutes
  await queue.add(
    'auto-record-check',
    { type: 'check' },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'auto-record-check',
    }
  );

  logger.info('Scheduled auto-record checks every 5 minutes');
}
