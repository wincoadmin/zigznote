/**
 * Transcription job processor
 * Processes audio files through Deepgram and stores results
 */

import { Job } from 'bullmq';
import pino from 'pino';
import { deepgramService } from './deepgramService';
import type { TranscriptionJob, TranscriptionResult } from './types';
import { transcriptRepository, meetingRepository } from '@zigznote/database';
import { QUEUE_NAMES } from '@zigznote/shared';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MIN_MEETING_DURATION_MS = 30 * 1000; // 30 seconds minimum

// Connection for queuing summarization jobs
let redisConnection: Redis | null = null;
let summarizationQueue: Queue | null = null;

/**
 * Get or create Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}

/**
 * Get or create summarization queue
 */
function getSummarizationQueue(): Queue {
  if (!summarizationQueue) {
    summarizationQueue = new Queue(QUEUE_NAMES.SUMMARIZATION, {
      connection: getRedisConnection(),
    });
  }
  return summarizationQueue;
}

/**
 * Process a transcription job
 */
export async function processTranscriptionJob(
  job: Job<TranscriptionJob>
): Promise<TranscriptionResult> {
  const { meetingId, audioUrl, language = 'en' } = job.data;

  logger.info({ jobId: job.id, meetingId, audioUrl }, 'Processing transcription job');

  try {
    // Update meeting status to processing
    await meetingRepository.update(meetingId, {
      status: 'processing',
    });

    // Transcribe with Deepgram
    const transcript = await deepgramService.transcribeUrl(audioUrl, {
      language,
      diarize: true,
      punctuate: true,
      smartFormat: true,
      paragraphs: true,
      utterances: true,
    });

    // Check if meeting is too short (< 30 seconds)
    if (transcript.durationMs < MIN_MEETING_DURATION_MS) {
      logger.info(
        { meetingId, durationMs: transcript.durationMs },
        'Meeting too short, skipping transcript storage'
      );

      await meetingRepository.update(meetingId, {
        status: 'completed',
        metadata: {
          skipped: true,
          reason: 'Meeting duration less than 30 seconds',
          durationMs: transcript.durationMs,
        },
      });

      return {
        meetingId,
        transcriptId: '',
        wordCount: 0,
        durationMs: transcript.durationMs,
      };
    }

    // Store transcript in database
    const storedTranscript = await transcriptRepository.createTranscript({
      meetingId,
      segments: JSON.parse(JSON.stringify(transcript.segments)),
      fullText: transcript.fullText,
      wordCount: transcript.wordCount,
      language: transcript.language,
    });

    // Update meeting with duration
    await meetingRepository.update(meetingId, {
      durationSeconds: Math.floor(transcript.durationMs / 1000),
    });

    // Add participants from speakers
    if (transcript.speakers.length > 0) {
      await meetingRepository.addParticipants(
        meetingId,
        transcript.speakers.map((speaker) => ({
          name: speaker.label,
          speakerLabel: speaker.id,
        }))
      );
    }

    // Log quality warning if present
    if (transcript.qualityWarning) {
      logger.warn(
        { meetingId, averageConfidence: transcript.averageConfidence },
        'Low confidence transcription - audio quality may be poor'
      );

      // Store quality warning in meeting metadata
      await meetingRepository.update(meetingId, {
        metadata: {
          qualityWarning: true,
          averageConfidence: transcript.averageConfidence,
        },
      });
    }

    // Queue summarization job
    const queue = getSummarizationQueue();
    await queue.add('generate', {
      meetingId,
      transcriptId: storedTranscript.id,
    });

    logger.info(
      {
        meetingId,
        transcriptId: storedTranscript.id,
        wordCount: transcript.wordCount,
        speakerCount: transcript.speakers.length,
      },
      'Transcription completed successfully'
    );

    return {
      meetingId,
      transcriptId: storedTranscript.id,
      wordCount: transcript.wordCount,
      durationMs: transcript.durationMs,
    };
  } catch (error) {
    logger.error({ error, meetingId }, 'Transcription job failed');

    // Update meeting status to failed
    await meetingRepository.update(meetingId, {
      status: 'failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Transcription failed',
        failedAt: new Date().toISOString(),
      },
    });

    throw error;
  }
}

/**
 * Handle job failure (called after all retries exhausted)
 */
export async function handleJobFailure(
  job: Job<TranscriptionJob>,
  error: Error
): Promise<void> {
  const { meetingId } = job.data;

  logger.error(
    { jobId: job.id, meetingId, error: error.message, attempts: job.attemptsMade },
    'Transcription job permanently failed'
  );

  // Mark meeting as failed permanently
  await meetingRepository.update(meetingId, {
    status: 'failed',
    metadata: {
      error: error.message,
      failedAt: new Date().toISOString(),
      permanent: true,
      attempts: job.attemptsMade,
    },
  });
}

/**
 * Cleanup resources
 */
export async function cleanup(): Promise<void> {
  if (summarizationQueue) {
    await summarizationQueue.close();
    summarizationQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
