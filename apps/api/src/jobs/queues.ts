/**
 * BullMQ queue instances
 */

import { Queue, Job, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  type TranscriptionJobData,
  type SummarizationJobData,
  type WebhookJobData,
  type CalendarSyncJobData,
} from '@zigznote/shared';

/**
 * Email job data for dunning/notification emails
 */
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Redis connection for BullMQ
 */
let connection: IORedis | null = null;

/**
 * Gets or creates the Redis connection
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    connection.on('connect', () => {
      logger.info('Connected to Redis for BullMQ');
    });
  }

  return connection;
}

/**
 * Gets the connection as BullMQ ConnectionOptions (cast for type compatibility)
 * This is needed because bullmq bundles its own ioredis version with incompatible types
 */
export function getBullMQConnection(): ConnectionOptions {
  return getRedisConnection() as unknown as ConnectionOptions;
}

/**
 * Queue instances
 */
let transcriptionQueue: Queue<TranscriptionJobData> | null = null;
let summarizationQueue: Queue<SummarizationJobData> | null = null;
let webhookQueue: Queue<WebhookJobData> | null = null;
let calendarSyncQueue: Queue<CalendarSyncJobData> | null = null;
let emailQueue: Queue<EmailJobData> | null = null;

/**
 * Gets or creates the transcription queue
 */
export function getTranscriptionQueue(): Queue<TranscriptionJobData> {
  if (!transcriptionQueue) {
    transcriptionQueue = new Queue<TranscriptionJobData>(
      QUEUE_NAMES.TRANSCRIPTION,
      {
        connection: getBullMQConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }
    ) as Queue<TranscriptionJobData>;
  }
  return transcriptionQueue!;
}

/**
 * Gets or creates the summarization queue
 */
export function getSummarizationQueue(): Queue<SummarizationJobData> {
  if (!summarizationQueue) {
    summarizationQueue = new Queue<SummarizationJobData>(
      QUEUE_NAMES.SUMMARIZATION,
      {
        connection: getBullMQConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }
    ) as Queue<SummarizationJobData>;
  }
  return summarizationQueue!;
}

/**
 * Gets or creates the webhook queue
 */
export function getWebhookQueue(): Queue<WebhookJobData> {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookJobData>(QUEUE_NAMES.WEBHOOK, {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5, // More retries for webhooks
      },
    }) as Queue<WebhookJobData>;
  }
  return webhookQueue!;
}

/**
 * Gets or creates the calendar sync queue
 */
export function getCalendarSyncQueue(): Queue<CalendarSyncJobData> {
  if (!calendarSyncQueue) {
    calendarSyncQueue = new Queue<CalendarSyncJobData>(
      QUEUE_NAMES.CALENDAR_SYNC,
      {
        connection: getBullMQConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }
    ) as Queue<CalendarSyncJobData>;
  }
  return calendarSyncQueue!;
}

/**
 * Gets or creates the email queue
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>('email', {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5, // More retries for emails
      },
    }) as Queue<EmailJobData>;
  }
  return emailQueue!;
}

/**
 * Adds a transcription job to the queue
 */
export async function queueTranscriptionJob(
  data: TranscriptionJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job<TranscriptionJobData>> {
  const queue = getTranscriptionQueue();
  return queue.add('process', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

/**
 * Adds a summarization job to the queue
 */
export async function queueSummarizationJob(
  data: SummarizationJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job<SummarizationJobData>> {
  const queue = getSummarizationQueue();
  return queue.add('generate', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

/**
 * Adds a webhook delivery job to the queue
 */
export async function queueWebhookJob(
  data: WebhookJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job<WebhookJobData>> {
  const queue = getWebhookQueue();
  return queue.add('deliver', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

/**
 * Adds a calendar sync job to the queue
 */
export async function queueCalendarSyncJob(
  data: CalendarSyncJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job<CalendarSyncJobData>> {
  const queue = getCalendarSyncQueue();
  return queue.add('sync', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

/**
 * Adds an email job to the queue
 */
export async function queueEmailJob(
  data: EmailJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job<EmailJobData>> {
  const queue = getEmailQueue();
  return queue.add('send', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

/**
 * Closes all queue connections
 */
export async function closeQueues(): Promise<void> {
  const queues = [
    transcriptionQueue,
    summarizationQueue,
    webhookQueue,
    calendarSyncQueue,
    emailQueue,
  ].filter(Boolean) as Queue[];

  await Promise.all(queues.map((q) => q.close()));

  if (connection) {
    await connection.quit();
    connection = null;
  }

  transcriptionQueue = null;
  summarizationQueue = null;
  webhookQueue = null;
  calendarSyncQueue = null;
  emailQueue = null;

  logger.info('All queues closed');
}

/**
 * Gets queue statistics
 */
export async function getQueueStats(): Promise<Record<string, {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}>> {
  const queues = {
    transcription: getTranscriptionQueue(),
    summarization: getSummarizationQueue(),
    webhook: getWebhookQueue(),
    calendarSync: getCalendarSyncQueue(),
    email: getEmailQueue(),
  };

  const stats: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> = {};

  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    stats[name] = { waiting, active, completed, failed, delayed };
  }

  return stats;
}
