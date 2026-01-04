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
  queueSummarizationJob,
  queueWebhookJob,
  queueCalendarSyncJob,
  closeQueues,
  getQueueStats,
} from './queues';

// Re-export shared queue definitions
export {
  QUEUE_NAMES,
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  JOB_PRIORITY,
} from '@zigznote/shared';
