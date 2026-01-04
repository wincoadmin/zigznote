/**
 * Summarization job processor
 * Processes transcripts through LLM and stores results
 */

import { Job } from 'bullmq';
import pino from 'pino';
import { llmService, LLMService } from './llmService';
import { outputParser, OutputParser } from './outputParser';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_CHUNKED } from './prompts/system';
import {
  buildSummaryPrompt,
  buildChunkPrompt,
  buildConsolidationPrompt,
  PROMPT_VERSION,
} from './prompts/summary';
import type {
  SummarizationJob,
  SummarizationResult,
  SummaryOutput,
  SummaryPromptContext,
  Topic,
  ActionItem,
} from './types';
import { transcriptRepository, meetingRepository } from '@zigznote/database';
import { MEETING_STATUS } from '@zigznote/shared';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Summarization processor class
 */
export class SummarizationProcessor {
  private llm: LLMService;
  private parser: OutputParser;

  constructor(llm: LLMService = llmService, parser: OutputParser = outputParser) {
    this.llm = llm;
    this.parser = parser;
  }

  /**
   * Process a summarization job
   */
  async process(job: Job<SummarizationJob>): Promise<SummarizationResult> {
    const { meetingId, transcriptId, forceModel, customPrompt } = job.data;
    const startTime = Date.now();

    logger.info({ jobId: job.id, meetingId, transcriptId }, 'Processing summarization job');

    try {
      // Get transcript from database
      const transcript = await transcriptRepository.findById(transcriptId);
      if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
      }

      // Get meeting for metadata
      const meeting = await meetingRepository.findById(meetingId);
      if (!meeting) {
        throw new Error(`Meeting not found: ${meetingId}`);
      }

      // Get participant names if available
      const participants = await meetingRepository.getParticipants(meetingId);
      const participantNames = participants.map((p) => p.name);

      // Build context
      const context: SummaryPromptContext = {
        transcript: transcript.fullText,
        meetingTitle: meeting.title,
        participants: participantNames,
        meetingDuration: meeting.durationSeconds || undefined,
      };

      // Count words to determine if chunking is needed
      const wordCount = this.llm.countWords(transcript.fullText);
      logger.info({ meetingId, wordCount }, 'Transcript word count');

      let summary: SummaryOutput;
      let tokensUsed = 0;
      let modelUsed = '';

      if (this.llm.needsChunking(wordCount)) {
        // Process in chunks for long transcripts
        const result = await this.processChunked(context, forceModel);
        summary = result.summary;
        tokensUsed = result.tokensUsed;
        modelUsed = result.modelUsed;
      } else {
        // Process in single request
        const result = await this.processSingle(context, forceModel, customPrompt);
        summary = result.summary;
        tokensUsed = result.tokensUsed;
        modelUsed = result.modelUsed;
      }

      // Store summary in database
      const storedSummary = await transcriptRepository.upsertSummary({
        meetingId,
        content: JSON.parse(JSON.stringify(summary)),
        modelUsed,
        promptVersion: PROMPT_VERSION,
      });

      // Store action items
      if (summary.actionItems.length > 0) {
        // Delete existing action items first (for regeneration)
        await transcriptRepository.deleteActionItemsByMeetingId(meetingId);

        // Create new action items
        await transcriptRepository.createActionItems(
          summary.actionItems.map((item) => ({
            meetingId,
            text: item.text,
            assignee: item.assignee,
            dueDate: item.dueDate ? this.parseDueDate(item.dueDate) : undefined,
          }))
        );
      }

      // Update meeting status
      await meetingRepository.update(meetingId, {
        status: MEETING_STATUS.COMPLETED,
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info(
        {
          meetingId,
          summaryId: storedSummary.id,
          actionItemCount: summary.actionItems.length,
          tokensUsed,
          modelUsed,
          processingTimeMs,
        },
        'Summarization completed'
      );

      return {
        meetingId,
        summaryId: storedSummary.id,
        actionItemCount: summary.actionItems.length,
        tokensUsed,
        modelUsed,
        processingTimeMs,
      };
    } catch (error) {
      logger.error({ error, meetingId }, 'Summarization job failed');

      // Update meeting status to failed
      await meetingRepository.update(meetingId, {
        status: MEETING_STATUS.FAILED,
        metadata: {
          error: error instanceof Error ? error.message : 'Summarization failed',
          failedAt: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * Process single transcript (< chunk threshold)
   */
  private async processSingle(
    context: SummaryPromptContext,
    forceModel?: 'claude' | 'gpt',
    customPrompt?: string
  ): Promise<{ summary: SummaryOutput; tokensUsed: number; modelUsed: string }> {
    const wordCount = this.llm.countWords(context.transcript);
    const prompt = customPrompt || buildSummaryPrompt(context);

    const response = await this.llm.generateWithFallback(prompt, wordCount, {
      systemPrompt: SYSTEM_PROMPT,
      forceModel,
      jsonMode: true,
    });

    const summary = this.parser.parseSummary(response.content);

    return {
      summary,
      tokensUsed: response.tokensUsed.total,
      modelUsed: response.selection.model,
    };
  }

  /**
   * Process long transcript in chunks
   */
  private async processChunked(
    context: SummaryPromptContext,
    forceModel?: 'claude' | 'gpt'
  ): Promise<{ summary: SummaryOutput; tokensUsed: number; modelUsed: string }> {
    const chunks = this.llm.chunkTranscript(context.transcript);
    logger.info({ chunkCount: chunks.length }, 'Processing transcript in chunks');

    const chunkSummaries: Array<{
      topics: Topic[];
      actionItems: ActionItem[];
      decisions: string[];
      questions: string[];
    }> = [];

    let totalTokens = 0;
    let modelUsed = '';

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const chunkPrompt = buildChunkPrompt(chunk, i, chunks.length, context);
      const chunkWordCount = this.llm.countWords(chunk);

      const response = await this.llm.generateWithFallback(chunkPrompt, chunkWordCount, {
        systemPrompt: SYSTEM_PROMPT_CHUNKED,
        forceModel,
        jsonMode: true,
      });

      const chunkResult = this.parser.parseChunkSummary(response.content);
      chunkSummaries.push(chunkResult);
      totalTokens += response.tokensUsed.total;
      modelUsed = response.selection.model;

      logger.info({ chunk: i + 1, totalChunks: chunks.length }, 'Chunk processed');
    }

    // Consolidate chunk summaries
    const consolidationPrompt = buildConsolidationPrompt(chunkSummaries, context);
    const consolidationWordCount = this.llm.countWords(consolidationPrompt);

    const consolidationResponse = await this.llm.generateWithFallback(
      consolidationPrompt,
      consolidationWordCount,
      {
        systemPrompt: SYSTEM_PROMPT,
        forceModel,
        jsonMode: true,
      }
    );

    const summary = this.parser.parseSummary(consolidationResponse.content);
    totalTokens += consolidationResponse.tokensUsed.total;

    return {
      summary,
      tokensUsed: totalTokens,
      modelUsed,
    };
  }

  /**
   * Parse due date string to Date object
   * Handles relative dates like "next Monday", "by Friday", "in 2 weeks"
   */
  private parseDueDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // Try ISO date first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const lowerStr = dateStr.toLowerCase();
    const now = new Date();

    // Relative day handling
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Check for "next [day]" or "by [day]"
    for (let i = 0; i < dayNames.length; i++) {
      const dayName = dayNames[i]!;
      if (lowerStr.includes(dayName)) {
        const currentDay = now.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        if (lowerStr.includes('next')) daysUntil += 7;

        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + daysUntil);
        targetDate.setHours(17, 0, 0, 0); // Default to 5 PM
        return targetDate;
      }
    }

    // Check for "in X days/weeks"
    const inXMatch = lowerStr.match(/in\s+(\d+)\s+(day|week)s?/);
    if (inXMatch && inXMatch[1] && inXMatch[2]) {
      const amount = parseInt(inXMatch[1], 10);
      const unit = inXMatch[2];
      const targetDate = new Date(now);
      if (unit === 'day') {
        targetDate.setDate(now.getDate() + amount);
      } else {
        targetDate.setDate(now.getDate() + amount * 7);
      }
      targetDate.setHours(17, 0, 0, 0);
      return targetDate;
    }

    // Check for "tomorrow"
    if (lowerStr.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      return tomorrow;
    }

    // Check for "end of week"
    if (lowerStr.includes('end of week') || lowerStr.includes('eow')) {
      const friday = new Date(now);
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      friday.setDate(now.getDate() + daysUntilFriday);
      friday.setHours(17, 0, 0, 0);
      return friday;
    }

    // Check for "end of month" or "eom"
    if (lowerStr.includes('end of month') || lowerStr.includes('eom')) {
      const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      eom.setHours(17, 0, 0, 0);
      return eom;
    }

    // Couldn't parse - return undefined
    logger.debug({ dateStr }, 'Could not parse due date');
    return undefined;
  }

  /**
   * Handle job failure
   */
  async handleFailure(job: Job<SummarizationJob>, error: Error): Promise<void> {
    const { meetingId } = job.data;

    logger.error(
      { jobId: job.id, meetingId, error: error.message, attempts: job.attemptsMade },
      'Summarization job permanently failed'
    );

    await meetingRepository.update(meetingId, {
      status: MEETING_STATUS.FAILED,
      metadata: {
        error: error.message,
        failedAt: new Date().toISOString(),
        permanent: true,
        attempts: job.attemptsMade,
      },
    });
  }
}

// Export singleton instance
export const summarizationProcessor = new SummarizationProcessor();

// Export process function for worker
export async function processSummarizationJob(
  job: Job<SummarizationJob>
): Promise<SummarizationResult> {
  return summarizationProcessor.process(job);
}

export async function handleJobFailure(job: Job<SummarizationJob>, error: Error): Promise<void> {
  return summarizationProcessor.handleFailure(job, error);
}
