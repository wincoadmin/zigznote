/**
 * Transcription worker service
 * Processes audio files through Deepgram for transcription with speaker diarization
 */

import { Worker, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import dotenv from 'dotenv';
import { processTranscriptionJob, handleJobFailure, cleanup } from './processor';
import type { TranscriptionJob, TranscriptionResult } from './types';

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'transcription';
const CONCURRENCY = parseInt(process.env.TRANSCRIPTION_CONCURRENCY || '5', 10);

/**
 * Start the transcription worker
 */
function startWorker(): void {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<TranscriptionJob, TranscriptionResult>(
    QUEUE_NAME,
    processTranscriptionJob,
    {
      connection: connection as unknown as ConnectionOptions,
      concurrency: CONCURRENCY,
      // Job lock settings
      lockDuration: 300000, // 5 minutes - transcription can take time
      stalledInterval: 60000, // Check for stalled jobs every minute
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(
      {
        jobId: job.id,
        meetingId: result.meetingId,
        wordCount: result.wordCount,
        durationMs: result.durationMs,
      },
      'Transcription job completed'
    );
  });

  worker.on('failed', async (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message, attempts: job?.attemptsMade },
      'Transcription job failed'
    );

    // Handle permanent failure (all retries exhausted)
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await handleJobFailure(job, err);
    }
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled - will be reprocessed');
  });

  logger.info(
    { concurrency: CONCURRENCY, queue: QUEUE_NAME },
    'Transcription worker started'
  );

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    try {
      // Close worker first to stop accepting new jobs
      await worker.close();
      logger.info('Worker closed');

      // Cleanup processor resources
      await cleanup();
      logger.info('Processor resources cleaned up');

      // Close Redis connection
      await connection.quit();
      logger.info('Redis connection closed');

      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the worker
startWorker();

// Export for testing
export { processTranscriptionJob } from './processor';
export { deepgramService } from './deepgramService';
export * from './types';
export * from './utils';
