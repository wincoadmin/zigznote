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

// Re-export shared queue definitions
export {
  QUEUE_NAMES,
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  JOB_PRIORITY,
} from '@zigznote/shared';
