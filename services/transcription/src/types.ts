/**
 * Type definitions for transcription service
 */

/**
 * Transcription job data from queue
 */
export interface TranscriptionJob {
  meetingId: string;
  audioUrl: string;
  language?: string;
  diarize?: boolean;
  punctuate?: boolean;
  organizationId?: string;
  source?: 'bot' | 'upload' | 'browser' | 'mobile';
  /** Recall.ai bot ID (only for bot source) */
  recallBotId?: string;
}

/**
 * Individual transcript segment
 */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  words?: Word[];
}

/**
 * Individual word with timing
 */
export interface Word {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speaker?: number;
  punctuatedWord?: string;
}

/**
 * Speaker information
 */
export interface Speaker {
  id: string;
  label: string;
  totalSpeakingTimeMs: number;
  wordCount: number;
}

/**
 * Processed transcript result
 */
export interface ProcessedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  speakers: Speaker[];
  durationMs: number;
  language: string;
  averageConfidence: number;
  qualityWarning: boolean;
}

/**
 * Transcription result for job completion
 */
export interface TranscriptionResult {
  meetingId: string;
  transcriptId: string;
  wordCount: number;
  durationMs: number;
}

/**
 * Deepgram API response types
 */
export interface DeepgramResponse {
  metadata: {
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info: Record<string, unknown>;
  };
  results: {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
}

export interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

export interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
  paragraphs?: {
    paragraphs: DeepgramParagraph[];
  };
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface DeepgramParagraph {
  sentences: DeepgramSentence[];
  speaker?: number;
  start: number;
  end: number;
}

export interface DeepgramSentence {
  text: string;
  start: number;
  end: number;
}

export interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker: number;
  id: string;
}

/**
 * Keyword for custom vocabulary boosting
 */
export interface KeywordBoost {
  keyword: string;
  boost: number;
}

/**
 * Options for transcription
 */
export interface TranscribeOptions {
  language?: string;
  diarize?: boolean;
  punctuate?: boolean;
  smartFormat?: boolean;
  paragraphs?: boolean;
  utterances?: boolean;
  model?: string;
  /** Custom keywords to boost recognition */
  keywords?: KeywordBoost[];
}

/**
 * Live transcription connection (for future use)
 */
export interface LiveConnection {
  send(data: Buffer): void;
  close(): void;
  on(event: 'transcript', callback: (data: TranscriptSegment) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'close', callback: () => void): void;
}

export interface LiveOptions {
  language?: string;
  interimResults?: boolean;
  punctuate?: boolean;
  diarize?: boolean;
}
