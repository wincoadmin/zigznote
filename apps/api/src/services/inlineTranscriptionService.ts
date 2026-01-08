/**
 * Inline Transcription Service
 * Transcribes small audio files directly without creating a meeting
 * Used for chat attachments
 */

import pino from 'pino';
import { config } from '../config';
import { apiKeyProvider, ApiProviders } from './apiKeyProvider';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface TranscriptionResult {
  text: string;
  duration: number;
  wordCount: number;
  confidence: number;
}

interface DeepgramResponse {
  metadata?: {
    duration?: number;
    channels?: number;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
  };
}

class InlineTranscriptionService {
  private readonly baseUrl: string;
  private readonly maxFileSizeMB = 25; // Limit inline transcription to 25MB

  constructor() {
    this.baseUrl = config.deepgram.baseUrl;
  }

  /**
   * Get Deepgram API key (from DB or env)
   */
  private async getApiKey(): Promise<string | null> {
    return apiKeyProvider.getKey(ApiProviders.DEEPGRAM);
  }

  /**
   * Check if the service is configured
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return Boolean(apiKey);
  }

  /**
   * Transcribe an audio buffer directly
   */
  async transcribe(buffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    // Validate file size
    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > this.maxFileSizeMB) {
      throw new Error(`File too large for inline transcription. Maximum size is ${this.maxFileSizeMB}MB`);
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/listen?model=nova-2&smart_format=true&language=en`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: new Uint8Array(buffer),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          'Deepgram transcription failed'
        );
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = (await response.json()) as DeepgramResponse;

      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
      const duration = data.metadata?.duration || 0;
      const wordCount = transcript.split(/\s+/).filter(Boolean).length;

      const latencyMs = Date.now() - startTime;
      logger.info(
        { duration, wordCount, confidence, latencyMs },
        'Inline transcription completed'
      );

      return {
        text: transcript,
        duration: Math.round(duration),
        wordCount,
        confidence,
      };
    } catch (error) {
      logger.error({ error }, 'Inline transcription error');
      throw error;
    }
  }
}

export const inlineTranscriptionService = new InlineTranscriptionService();
