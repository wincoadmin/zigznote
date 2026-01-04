/**
 * Deepgram transcription service
 * Handles audio transcription with speaker diarization
 */

import pino from 'pino';
import type {
  DeepgramResponse,
  ProcessedTranscript,
  TranscriptSegment,
  Speaker,
  TranscribeOptions,
} from './types';
import {
  extractSpeakersFromWords,
  extractSpeakersFromUtterances,
  groupWordsBySpeaker,
  utterancesToSegments,
  mergeAdjacentSegments,
} from './utils/diarization';
import {
  alternativeToSegments,
  getFullTextFromSegments,
  getWordCountFromSegments,
  getAverageConfidence,
} from './utils/segments';
import { secondsToMs } from './utils/timing';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_BASE_URL = process.env.DEEPGRAM_BASE_URL || 'https://api.deepgram.com/v1';
const CONFIDENCE_WARNING_THRESHOLD = 0.7;

/**
 * Service for interacting with Deepgram API
 */
class DeepgramService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = DEEPGRAM_API_KEY;
    this.baseUrl = DEEPGRAM_BASE_URL;
  }

  /**
   * Transcribe audio from URL
   */
  async transcribeUrl(
    audioUrl: string,
    options: TranscribeOptions = {}
  ): Promise<ProcessedTranscript> {
    const {
      language = 'en',
      diarize = true,
      punctuate = true,
      smartFormat = true,
      paragraphs = true,
      utterances = true,
      model = 'nova-2',
    } = options;

    logger.info({ audioUrl, options }, 'Starting transcription');

    // Build query params
    const params = new URLSearchParams({
      model,
      language,
      punctuate: String(punctuate),
      diarize: String(diarize),
      smart_format: String(smartFormat),
      paragraphs: String(paragraphs),
      utterances: String(utterances),
    });

    try {
      const response = await fetch(`${this.baseUrl}/listen?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: audioUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'Deepgram API error');
        throw new Error(`Deepgram API error: ${errorText}`);
      }

      const data = (await response.json()) as DeepgramResponse;
      logger.info({ requestId: data.metadata.request_id }, 'Transcription completed');

      return this.processResults(data, language);
    } catch (error) {
      logger.error({ error }, 'Transcription failed');
      throw error;
    }
  }

  /**
   * Transcribe audio from buffer (for uploaded files)
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    mimeType: string,
    options: TranscribeOptions = {}
  ): Promise<ProcessedTranscript> {
    const {
      language = 'en',
      diarize = true,
      punctuate = true,
      smartFormat = true,
      paragraphs = true,
      utterances = true,
      model = 'nova-2',
    } = options;

    logger.info({ bufferSize: audioBuffer.length, mimeType }, 'Starting buffer transcription');

    const params = new URLSearchParams({
      model,
      language,
      punctuate: String(punctuate),
      diarize: String(diarize),
      smart_format: String(smartFormat),
      paragraphs: String(paragraphs),
      utterances: String(utterances),
    });

    try {
      const response = await fetch(`${this.baseUrl}/listen?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': mimeType,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'Deepgram API error');
        throw new Error(`Deepgram API error: ${errorText}`);
      }

      const data = (await response.json()) as DeepgramResponse;
      return this.processResults(data, language);
    } catch (error) {
      logger.error({ error }, 'Buffer transcription failed');
      throw error;
    }
  }

  /**
   * Process Deepgram response into standardized format
   */
  processResults(data: DeepgramResponse, language: string): ProcessedTranscript {
    const channel = data.results.channels[0];
    if (!channel) {
      throw new Error('No channels in Deepgram response');
    }

    const alternative = channel.alternatives[0];
    if (!alternative) {
      throw new Error('No alternatives in Deepgram response');
    }

    const durationMs = secondsToMs(data.metadata.duration);
    let segments: TranscriptSegment[];
    let speakers: Speaker[];

    // Use utterances if available (better for diarization)
    if (data.results.utterances && data.results.utterances.length > 0) {
      segments = utterancesToSegments(data.results.utterances);
      speakers = extractSpeakersFromUtterances(data.results.utterances);
    } else if (alternative.words.some((w) => w.speaker !== undefined)) {
      // Use word-level speaker labels
      segments = groupWordsBySpeaker(alternative.words);
      speakers = extractSpeakersFromWords(alternative.words);
    } else {
      // No diarization, use paragraphs or time-based segments
      segments = alternativeToSegments(alternative);
      speakers = [{ id: 'speaker_0', label: 'Speaker 1', totalSpeakingTimeMs: durationMs, wordCount: alternative.words.length }];
    }

    // Merge adjacent segments from same speaker
    segments = mergeAdjacentSegments(segments);

    const fullText = getFullTextFromSegments(segments);
    const wordCount = getWordCountFromSegments(segments);
    const averageConfidence = getAverageConfidence(segments);
    const qualityWarning = averageConfidence < CONFIDENCE_WARNING_THRESHOLD;

    if (qualityWarning) {
      logger.warn({ averageConfidence }, 'Low confidence transcription');
    }

    return {
      segments,
      fullText,
      wordCount,
      speakers,
      durationMs,
      language,
      averageConfidence,
      qualityWarning,
    };
  }

  /**
   * Extract speakers from raw Deepgram response
   */
  extractSpeakers(data: DeepgramResponse): Speaker[] {
    if (data.results.utterances && data.results.utterances.length > 0) {
      return extractSpeakersFromUtterances(data.results.utterances);
    }

    const alternative = data.results.channels[0]?.alternatives[0];
    if (alternative) {
      return extractSpeakersFromWords(alternative.words);
    }

    return [];
  }

  /**
   * Check if Deepgram API is configured and reachable
   */
  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Deepgram API key not configured');
      return false;
    }

    try {
      // Use a minimal test request
      const response = await fetch(`${this.baseUrl}/listen?model=nova-2`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://example.com/test.mp3' }),
      });

      // 400 means API is reachable but URL is invalid (expected)
      // 401 means API key is invalid
      return response.status !== 401;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const deepgramService = new DeepgramService();
