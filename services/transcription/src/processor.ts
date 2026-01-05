/**
 * Transcription job processor
 * Processes audio files through Deepgram and stores results
 */

import { Job } from 'bullmq';
import pino from 'pino';
import { deepgramService } from './deepgramService';
import type { TranscriptionJob, TranscriptionResult, TranscriptSegment, Word } from './types';
import {
  transcriptRepository,
  meetingRepository,
  speakerAliasRepository,
  customVocabularyRepository,
} from '@zigznote/database';
import { QUEUE_NAMES } from '@zigznote/shared';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  TranscriptPostProcessor,
  type TranscriptSegment as PostProcessorSegment,
} from './postProcessor';
import { speakerRecognitionService } from './speakerRecognition';

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

    // Get meeting to retrieve organization ID early for custom vocabulary
    const meetingForVocab = await meetingRepository.findById(meetingId);
    const orgId = meetingForVocab?.organizationId;

    // Load custom vocabulary for Deepgram keywords boosting
    let keywords: Array<{ keyword: string; boost: number }> = [];
    if (orgId) {
      keywords = await customVocabularyRepository.getDeepgramKeywords(orgId);
      if (keywords.length > 0) {
        logger.debug({ orgId, keywordCount: keywords.length }, 'Using custom vocabulary');
      }
    }

    // Transcribe with Deepgram
    const transcript = await deepgramService.transcribeUrl(audioUrl, {
      language,
      diarize: true,
      punctuate: true,
      smartFormat: true,
      paragraphs: true,
      utterances: true,
      keywords,
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

    // Load existing speaker aliases for the organization
    let speakerAliases = new Map<string, string>();
    if (orgId) {
      speakerAliases = await speakerAliasRepository.findByOrganizationAsMap(orgId);
      if (speakerAliases.size > 0) {
        logger.debug({ orgId, aliasCount: speakerAliases.size }, 'Loaded existing speaker aliases');
      }
    }

    // === SPEAKER RECOGNITION ===
    // Detect speaker names from verbal introductions
    if (orgId) {
      try {
        // Convert to recognition format
        const recognitionSegments = transcript.segments.map((seg: TranscriptSegment) => ({
          speaker: seg.speaker,
          text: seg.text,
          startTime: seg.startMs / 1000, // Convert ms to seconds
          endTime: seg.endMs / 1000,
        }));

        const recognitionResult = await speakerRecognitionService.recognizeSpeakers(
          recognitionSegments,
          {
            organizationId: orgId,
            meetingId,
            existingAliases: speakerAliases,
          }
        );

        // Merge detected names with existing aliases (detected names take priority for new speakers)
        for (const [label, name] of recognitionResult.speakerMap) {
          if (!speakerAliases.has(label)) {
            speakerAliases.set(label, name);
          }
        }

        logger.info({
          meetingId,
          identifiedSpeakers: recognitionResult.speakerMap.size,
          newProfiles: recognitionResult.newProfiles.length,
          matchedProfiles: recognitionResult.matchedProfiles.length,
        }, 'Speaker recognition complete');
      } catch (recognitionError) {
        // Log but don't fail the entire transcription
        logger.error({ error: recognitionError, meetingId }, 'Speaker recognition failed, continuing with existing aliases');
      }
    }

    // Apply post-processing to transcript segments
    const postProcessor = new TranscriptPostProcessor({
      removeFillers: true,
      cleanSentenceBoundaries: true,
      highlightLowConfidence: true,
      confidenceThreshold: 0.7,
      speakerAliases,
    });

    // Convert segments to post-processor format (startMs/endMs -> startTime/endTime)
    const postProcessorSegments: PostProcessorSegment[] = transcript.segments.map(
      (seg: TranscriptSegment) => ({
        speaker: seg.speaker,
        text: seg.text,
        startTime: seg.startMs,
        endTime: seg.endMs,
        confidence: seg.confidence,
        words: seg.words?.map((w: Word) => ({
          word: w.word,
          start: w.startMs,
          end: w.endMs,
          confidence: w.confidence,
        })),
      })
    );

    const processedSegments = postProcessor.processTranscript(postProcessorSegments);
    const cleanedFullText = postProcessor.getFullText(processedSegments);

    logger.debug(
      {
        meetingId,
        originalWordCount: transcript.wordCount,
        processedSegments: processedSegments.length,
      },
      'Post-processing completed'
    );

    // Store transcript in database with both raw and cleaned versions
    const storedTranscript = await transcriptRepository.createTranscript({
      meetingId,
      segments: JSON.parse(JSON.stringify(transcript.segments)),
      fullText: cleanedFullText, // Store cleaned version as main text
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
