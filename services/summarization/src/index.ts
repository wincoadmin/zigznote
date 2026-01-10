/**
 * Summarization Worker Service
 * Processes summarization jobs from the BullMQ queue
 */

import { Worker, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import dotenv from 'dotenv';
import { QUEUE_NAMES } from '@zigznote/shared';
import { processSummarizationJob, handleJobFailure } from './processor';
import type { SummarizationJob, SummarizationResult } from './types';

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
const CONCURRENCY = parseInt(process.env.SUMMARIZATION_CONCURRENCY || '2', 10);

/**
 * Start the summarization worker
 */
function startWorker(): void {
  // Validate required environment variables
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (!hasAnthropicKey && !hasOpenAIKey) {
    logger.error('No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }

  logger.info(
    {
      hasAnthropicKey,
      hasOpenAIKey,
      concurrency: CONCURRENCY,
    },
    'Starting summarization worker'
  );

  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<SummarizationJob, SummarizationResult>(
    QUEUE_NAMES.SUMMARIZATION,
    processSummarizationJob,
    {
      connection: connection as unknown as ConnectionOptions,
      concurrency: CONCURRENCY,
      lockDuration: 300000, // 5 minutes for long summaries
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(
      {
        jobId: job.id,
        meetingId: result.meetingId,
        summaryId: result.summaryId,
        actionItemCount: result.actionItemCount,
        tokensUsed: result.tokensUsed,
        modelUsed: result.modelUsed,
        processingTimeMs: result.processingTimeMs,
      },
      'Summarization job completed'
    );
  });

  worker.on('failed', async (job, err) => {
    if (job) {
      logger.error(
        {
          jobId: job.id,
          meetingId: job.data.meetingId,
          error: err.message,
          attempts: job.attemptsMade,
        },
        'Summarization job failed'
      );

      // Handle permanent failure
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        await handleJobFailure(job, err);
      }
    } else {
      logger.error({ error: err.message }, 'Job failed without job reference');
    }
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled');
  });

  logger.info('Summarization worker started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker();
