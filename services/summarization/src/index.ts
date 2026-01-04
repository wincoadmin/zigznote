import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import dotenv from 'dotenv';

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
const QUEUE_NAME = 'summarization';

interface SummarizationJob {
  meetingId: string;
  transcript: string;
  options?: {
    customPrompt?: string;
    extractActionItems?: boolean;
    extractDecisions?: boolean;
  };
}

interface SummarizationResult {
  meetingId: string;
  summary: {
    executiveSummary: string;
    topics: Array<{
      title: string;
      summary: string;
    }>;
    decisions: string[];
    questions: string[];
    actionItems: Array<{
      text: string;
      assignee?: string;
    }>;
  };
  modelUsed: string;
}

/**
 * Process summarization job
 * In Phase 0, this is a placeholder that will be implemented with Claude in Phase 4
 */
async function processSummarization(
  job: Job<SummarizationJob>
): Promise<SummarizationResult> {
  const { meetingId, transcript, options } = job.data;

  logger.info({ meetingId, transcriptLength: transcript.length }, 'Processing summarization job');

  // TODO: Phase 4 - Implement Claude summarization
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const message = await anthropic.messages.create({
  //   model: 'claude-3-5-sonnet-20241022',
  //   max_tokens: 4096,
  //   messages: [{ role: 'user', content: summarizationPrompt }],
  // });

  // Placeholder response for Phase 0
  const result: SummarizationResult = {
    meetingId,
    summary: {
      executiveSummary: 'This is a placeholder summary for the meeting.',
      topics: [
        {
          title: 'Main Topic',
          summary: 'Discussion points and key takeaways.',
        },
      ],
      decisions: ['Placeholder decision item'],
      questions: ['What are the next steps?'],
      actionItems: options?.extractActionItems
        ? [{ text: 'Follow up on action item', assignee: 'Team' }]
        : [],
    },
    modelUsed: 'placeholder',
  };

  logger.info({ meetingId }, 'Summarization completed');
  return result;
}

/**
 * Start the summarization worker
 */
function startWorker(): void {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<SummarizationJob, SummarizationResult>(
    QUEUE_NAME,
    processSummarization,
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, meetingId: result.meetingId }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  logger.info('Summarization worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker');
    await worker.close();
    await connection.quit();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down worker');
    await worker.close();
    await connection.quit();
    process.exit(0);
  });
}

startWorker();
