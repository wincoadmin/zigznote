/**
 * Background job definitions and queue exports
 */

export {
  getRedisConnection,
  getTranscriptionQueue,
  getSummarizationQueue,
  getWebhookQueue,
  getCalendarSyncQueue,
  queueTranscriptionJob,
  queueTranscriptionJob as addTranscriptionJob,
  queueSummarizationJob,
  queueSummarizationJob as addSummarizationJob,
  queueWebhookJob,
  queueCalendarSyncJob,
  closeQueues,
  getQueueStats,
} from './queues';

export {
  createCalendarSyncWorker,
  schedulePeriodicCalendarSync,
} from './calendarSyncWorker';

export {
  getWeeklyDigestQueue,
  queueWeeklyDigest,
  queueAllWeeklyDigests,
  startWeeklyDigestWorker,
  stopWeeklyDigestWorker,
  scheduleWeeklyDigestCron,
} from './weeklyDigestWorker';

export {
  cleanupOrphanedBots,
  cleanupOrphanedStorage,
  checkExpiredGracePeriods,
  checkStorageGracePeriods,
  startCleanupWorker,
} from './cleanupWorker';

// Re-export shared queue definitions
export {
  QUEUE_NAMES,
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  JOB_PRIORITY,
} from '@zigznote/shared';
