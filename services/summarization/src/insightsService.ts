/**
 * Custom insights extraction service
 * Allows users to extract specific insights using templates
 */

import pino from 'pino';
import { llmService, LLMService } from './llmService';
import { outputParser, OutputParser } from './outputParser';
import { SYSTEM_PROMPT_INSIGHTS } from './prompts/system';
import { buildInsightPrompt, getBuiltInTemplate, BUILT_IN_TEMPLATES } from './prompts/insights';
import type { InsightTemplate, InsightResult } from './types';
import { transcriptRepository } from '@zigznote/database';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Custom insights service
 */
export class InsightsService {
  private llm: LLMService;
  private parser: OutputParser;

  constructor(llm: LLMService = llmService, parser: OutputParser = outputParser) {
    this.llm = llm;
    this.parser = parser;
  }

  /**
   * Get all available insight templates
   */
  getAvailableTemplates(): InsightTemplate[] {
    return BUILT_IN_TEMPLATES;
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): InsightTemplate | undefined {
    return getBuiltInTemplate(templateId);
  }

  /**
   * Extract insights from a meeting using a template
   */
  async extractInsights(
    meetingId: string,
    templateId: string,
    options?: { forceModel?: 'claude' | 'gpt' }
  ): Promise<{
    result: InsightResult;
    tokensUsed: number;
    modelUsed: string;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    logger.info({ meetingId, templateId }, 'Extracting insights');

    // Get template
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Get transcript
    const transcript = await transcriptRepository.findByMeetingId(meetingId, {
      meeting: true,
    });
    if (!transcript) {
      throw new Error(`Transcript not found for meeting: ${meetingId}`);
    }

    // Build prompt
    const prompt = buildInsightPrompt(template, transcript.fullText);
    const wordCount = this.llm.countWords(transcript.fullText);

    // Generate insight
    const response = await this.llm.generateWithFallback(prompt, wordCount, {
      systemPrompt: SYSTEM_PROMPT_INSIGHTS,
      forceModel: options?.forceModel,
      jsonMode: true,
    });

    // Parse result
    const result = this.parser.parseInsight(response.content, template.id, template.name);

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      {
        meetingId,
        templateId,
        tokensUsed: response.tokensUsed.total,
        processingTimeMs,
      },
      'Insights extracted'
    );

    return {
      result,
      tokensUsed: response.tokensUsed.total,
      modelUsed: response.selection.model,
      processingTimeMs,
    };
  }

  /**
   * Extract insights using a custom (user-defined) template
   */
  async extractCustomInsights(
    meetingId: string,
    template: InsightTemplate,
    options?: { forceModel?: 'claude' | 'gpt' }
  ): Promise<{
    result: InsightResult;
    tokensUsed: number;
    modelUsed: string;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    logger.info({ meetingId, templateId: template.id }, 'Extracting custom insights');

    // Get transcript
    const transcript = await transcriptRepository.findByMeetingId(meetingId, {
      meeting: true,
    });
    if (!transcript) {
      throw new Error(`Transcript not found for meeting: ${meetingId}`);
    }

    // Build prompt
    const prompt = buildInsightPrompt(template, transcript.fullText);
    const wordCount = this.llm.countWords(transcript.fullText);

    // Generate insight
    const response = await this.llm.generateWithFallback(prompt, wordCount, {
      systemPrompt: SYSTEM_PROMPT_INSIGHTS,
      forceModel: options?.forceModel,
      jsonMode: true,
    });

    // Parse result
    const result = this.parser.parseInsight(response.content, template.id, template.name);

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      {
        meetingId,
        templateId: template.id,
        tokensUsed: response.tokensUsed.total,
        processingTimeMs,
      },
      'Custom insights extracted'
    );

    return {
      result,
      tokensUsed: response.tokensUsed.total,
      modelUsed: response.selection.model,
      processingTimeMs,
    };
  }

  /**
   * Batch extract multiple insight types
   */
  async extractMultipleInsights(
    meetingId: string,
    templateIds: string[],
    options?: { forceModel?: 'claude' | 'gpt' }
  ): Promise<{
    results: InsightResult[];
    totalTokensUsed: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    const results: InsightResult[] = [];
    let totalTokensUsed = 0;

    for (const templateId of templateIds) {
      try {
        const { result, tokensUsed } = await this.extractInsights(meetingId, templateId, options);
        results.push(result);
        totalTokensUsed += tokensUsed;
      } catch (error) {
        logger.warn(
          { meetingId, templateId, error: (error as Error).message },
          'Failed to extract insight'
        );
        // Continue with other templates
      }
    }

    return {
      results,
      totalTokensUsed,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Export singleton instance
export const insightsService = new InsightsService();
