/**
 * Background job definitions
 * Jobs will be implemented with BullMQ in later phases
 */

export const JOB_NAMES = {
  TRANSCRIPTION: 'transcription',
  SUMMARIZATION: 'summarization',
  CALENDAR_SYNC: 'calendar-sync',
  WEBHOOK_DELIVERY: 'webhook-delivery',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/**
 * Job queue configuration
 */
export const JOB_OPTIONS = {
  [JOB_NAMES.TRANSCRIPTION]: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
  },
  [JOB_NAMES.SUMMARIZATION]: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
  },
  [JOB_NAMES.CALENDAR_SYNC]: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  },
  [JOB_NAMES.WEBHOOK_DELIVERY]: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
  },
};
