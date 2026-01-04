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
const QUEUE_NAME = 'transcription';

interface TranscriptionJob {
  meetingId: string;
  audioUrl: string;
  language?: string;
}

interface TranscriptionResult {
  meetingId: string;
  transcript: {
    segments: Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
      confidence: number;
    }>;
    fullText: string;
    wordCount: number;
    language: string;
  };
}

/**
 * Process transcription job
 * In Phase 0, this is a placeholder that will be implemented with Deepgram in Phase 3
 */
async function processTranscription(job: Job<TranscriptionJob>): Promise<TranscriptionResult> {
  const { meetingId, audioUrl, language = 'en' } = job.data;

  logger.info({ meetingId, audioUrl }, 'Processing transcription job');

  // TODO: Phase 3 - Implement Deepgram transcription
  // const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  // const transcription = await deepgram.transcription.preRecorded(
  //   { url: audioUrl },
  //   { punctuate: true, diarize: true, language }
  // );

  // Placeholder response for Phase 0
  const result: TranscriptionResult = {
    meetingId,
    transcript: {
      segments: [
        {
          speaker: 'Speaker 1',
          text: 'This is a placeholder transcript segment.',
          startMs: 0,
          endMs: 5000,
          confidence: 0.95,
        },
      ],
      fullText: 'This is a placeholder transcript segment.',
      wordCount: 7,
      language,
    },
  };

  logger.info({ meetingId }, 'Transcription completed');
  return result;
}

/**
 * Start the transcription worker
 */
function startWorker(): void {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<TranscriptionJob, TranscriptionResult>(
    QUEUE_NAME,
    processTranscription,
    {
      connection,
      concurrency: 5,
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

  logger.info('Transcription worker started');

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
