/**
 * LLM Service with provider abstraction and model selection
 * Supports Anthropic Claude and OpenAI GPT models
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import pino from 'pino';
import type {
  LLMRequestOptions,
  LLMResponse,
  ModelSelection,
  SummarizationConfig,
  LLMApiError,
} from './types';
import { AI_MODELS } from '@zigznote/shared';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SummarizationConfig = {
  modelSelectionThreshold: 5000, // words
  maxWordsPerChunk: 4000,
  temperature: 0.3,
  maxRetries: 3,
  retryDelay: 1000,
  promptVersion: '1.0.0',
};

/**
 * LLM Service class
 */
export class LLMService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private config: SummarizationConfig;

  constructor(config: Partial<SummarizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create Anthropic client
   */
  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  /**
   * Get or create OpenAI client
   */
  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Select the appropriate model based on transcript length
   * - Short transcripts (< 5000 words): GPT-4o-mini (cost efficient)
   * - Long transcripts (>= 5000 words): Claude 3.5 Sonnet (better quality)
   */
  selectModel(wordCount: number, forceModel?: 'claude' | 'gpt'): ModelSelection {
    // Handle forced model selection
    if (forceModel === 'claude') {
      return {
        provider: 'anthropic',
        model: AI_MODELS.CLAUDE_SONNET,
        reason: 'User requested Claude',
      };
    }

    if (forceModel === 'gpt') {
      return {
        provider: 'openai',
        model: AI_MODELS.GPT_4O_MINI,
        reason: 'User requested GPT',
      };
    }

    // Check API key availability
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    // If only one provider is available, use it
    if (hasAnthropicKey && !hasOpenAIKey) {
      return {
        provider: 'anthropic',
        model: AI_MODELS.CLAUDE_SONNET,
        reason: 'Only Anthropic API key available',
      };
    }

    if (hasOpenAIKey && !hasAnthropicKey) {
      return {
        provider: 'openai',
        model: AI_MODELS.GPT_4O_MINI,
        reason: 'Only OpenAI API key available',
      };
    }

    if (!hasAnthropicKey && !hasOpenAIKey) {
      throw new Error('No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    }

    // Both available - select based on word count
    if (wordCount >= this.config.modelSelectionThreshold) {
      return {
        provider: 'anthropic',
        model: AI_MODELS.CLAUDE_SONNET,
        reason: `Transcript is ${wordCount} words (>= ${this.config.modelSelectionThreshold}), using Claude for quality`,
      };
    }

    return {
      provider: 'openai',
      model: AI_MODELS.GPT_4O_MINI,
      reason: `Transcript is ${wordCount} words (< ${this.config.modelSelectionThreshold}), using GPT-4o-mini for cost`,
    };
  }

  /**
   * Generate completion using selected provider
   */
  async generateCompletion(
    prompt: string,
    selection: ModelSelection,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const { maxTokens = 4096, temperature = this.config.temperature, systemPrompt, jsonMode = true } = options;

    logger.info(
      {
        provider: selection.provider,
        model: selection.model,
        reason: selection.reason,
        promptLength: prompt.length,
      },
      'Generating LLM completion'
    );

    const startTime = Date.now();

    try {
      if (selection.provider === 'anthropic') {
        return await this.generateAnthropicCompletion(prompt, selection.model, {
          maxTokens,
          temperature,
          systemPrompt,
        });
      } else {
        return await this.generateOpenAICompletion(prompt, selection.model, {
          maxTokens,
          temperature,
          systemPrompt,
          jsonMode,
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(
        { error, provider: selection.provider, processingTime },
        'LLM completion failed'
      );
      throw error;
    }
  }

  /**
   * Generate completion using Anthropic Claude
   */
  private async generateAnthropicCompletion(
    prompt: string,
    model: string,
    options: { maxTokens: number; temperature: number; systemPrompt?: string }
  ): Promise<LLMResponse> {
    const client = this.getAnthropicClient();

    const message = await client.messages.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      tokensUsed: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        total: message.usage.input_tokens + message.usage.output_tokens,
      },
      model: message.model,
      finishReason: message.stop_reason || 'unknown',
    };
  }

  /**
   * Generate completion using OpenAI GPT
   */
  private async generateOpenAICompletion(
    prompt: string,
    model: string,
    options: { maxTokens: number; temperature: number; systemPrompt?: string; jsonMode: boolean }
  ): Promise<LLMResponse> {
    const client = this.getOpenAIClient();

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const completion = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content || '';

    return {
      content,
      tokensUsed: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
      model: completion.model,
      finishReason: choice?.finish_reason || 'unknown',
    };
  }

  /**
   * Generate with automatic retry and fallback
   */
  async generateWithFallback(
    prompt: string,
    wordCount: number,
    options: LLMRequestOptions & { forceModel?: 'claude' | 'gpt' } = {}
  ): Promise<LLMResponse & { selection: ModelSelection }> {
    const { forceModel, ...llmOptions } = options;

    // Get primary model selection
    const primarySelection = this.selectModel(wordCount, forceModel);
    let lastError: Error | null = null;

    // Try primary model with retries
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.generateCompletion(prompt, primarySelection, llmOptions);
        return { ...response, selection: primarySelection };
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { attempt, maxRetries: this.config.maxRetries, error: (error as Error).message },
          'LLM call failed, retrying'
        );

        // Check if error is retryable
        if ((error as LLMApiError).retryable === false) {
          break;
        }

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelay * attempt);
        }
      }
    }

    // If no forced model, try fallback to other provider
    if (!forceModel && primarySelection.provider === 'anthropic' && process.env.OPENAI_API_KEY) {
      logger.info({ primary: primarySelection.provider }, 'Falling back to OpenAI');

      const fallbackSelection: ModelSelection = {
        provider: 'openai',
        model: AI_MODELS.GPT_4O_MINI,
        reason: 'Fallback after Anthropic failure',
      };

      try {
        const response = await this.generateCompletion(prompt, fallbackSelection, llmOptions);
        return { ...response, selection: fallbackSelection };
      } catch (fallbackError) {
        logger.error({ error: (fallbackError as Error).message }, 'Fallback also failed');
      }
    }

    if (!forceModel && primarySelection.provider === 'openai' && process.env.ANTHROPIC_API_KEY) {
      logger.info({ primary: primarySelection.provider }, 'Falling back to Anthropic');

      const fallbackSelection: ModelSelection = {
        provider: 'anthropic',
        model: AI_MODELS.CLAUDE_SONNET,
        reason: 'Fallback after OpenAI failure',
      };

      try {
        const response = await this.generateCompletion(prompt, fallbackSelection, llmOptions);
        return { ...response, selection: fallbackSelection };
      } catch (fallbackError) {
        logger.error({ error: (fallbackError as Error).message }, 'Fallback also failed');
      }
    }

    throw lastError || new Error('LLM generation failed');
  }

  /**
   * Count words in text
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Check if transcript needs chunking
   */
  needsChunking(wordCount: number): boolean {
    return wordCount > this.config.maxWordsPerChunk;
  }

  /**
   * Split transcript into chunks
   */
  chunkTranscript(transcript: string): string[] {
    const words = transcript.split(/\s+/);
    const chunks: string[] = [];
    const chunkSize = this.config.maxWordsPerChunk;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      chunks.push(chunkWords.join(' '));
    }

    return chunks;
  }

  /**
   * Get current config
   */
  getConfig(): SummarizationConfig {
    return { ...this.config };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const llmService = new LLMService();
