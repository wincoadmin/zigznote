/**
 * Type definitions for summarization service
 */

/**
 * Summarization job data from queue
 */
export interface SummarizationJob {
  meetingId: string;
  transcriptId: string;
  promptVersion?: string;
  customPrompt?: string;
  forceModel?: 'claude' | 'gpt';
}

/**
 * LLM provider type
 */
export type LLMProvider = 'anthropic' | 'openai';

/**
 * Model selection result
 */
export interface ModelSelection {
  provider: LLMProvider;
  model: string;
  reason: string;
}

/**
 * Topic in the summary
 */
export interface Topic {
  title: string;
  summary: string;
  keyPoints: string[];
}

/**
 * Action item extracted from meeting
 */
export interface ActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Sentiment analysis result
 */
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

/**
 * Structured summary output
 */
export interface SummaryOutput {
  executiveSummary: string;
  topics: Topic[];
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[];
  sentiment: Sentiment;
}

/**
 * Custom insight extraction template
 */
export interface InsightTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  outputSchema: 'text' | 'list' | 'table' | 'json';
}

/**
 * Custom insight result
 */
export interface InsightResult {
  templateId: string;
  templateName: string;
  content: unknown;
}

/**
 * Summarization result for job completion
 */
export interface SummarizationResult {
  meetingId: string;
  summaryId: string;
  actionItemCount: number;
  tokensUsed: number;
  modelUsed: string;
  processingTimeMs: number;
}

/**
 * LLM request options
 */
export interface LLMRequestOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  jsonMode?: boolean;
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

/**
 * Prompt context for summary generation
 */
export interface SummaryPromptContext {
  transcript: string;
  meetingTitle?: string;
  participants?: string[];
  meetingDuration?: number;
  previousMeetingContext?: string;
}

/**
 * Chunked transcript for long meetings
 */
export interface TranscriptChunk {
  index: number;
  text: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Configuration for summarization
 */
export interface SummarizationConfig {
  /** Word count threshold for model selection (default: 5000) */
  modelSelectionThreshold: number;
  /** Maximum words per chunk for long transcripts */
  maxWordsPerChunk: number;
  /** Default temperature for LLM */
  temperature: number;
  /** Maximum retries for LLM calls */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelay: number;
  /** Current prompt version */
  promptVersion: string;
}

/**
 * Error types for summarization
 */
export class SummarizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SummarizationError';
  }
}

export class LLMApiError extends SummarizationError {
  constructor(
    message: string,
    public readonly provider: LLMProvider,
    public readonly statusCode?: number
  ) {
    super(message, 'LLM_API_ERROR', statusCode === 429 || statusCode === 503);
    this.name = 'LLMApiError';
  }
}

export class OutputParseError extends SummarizationError {
  constructor(message: string, public readonly rawOutput?: string) {
    super(message, 'OUTPUT_PARSE_ERROR', false);
    this.name = 'OutputParseError';
  }
}
