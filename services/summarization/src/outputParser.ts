/**
 * Output parser with Zod validation for LLM responses
 * Ensures structured output from AI models
 */

import { z } from 'zod';
import pino from 'pino';
import { OutputParseError } from './types';
import type { SummaryOutput, ActionItem, Topic, InsightResult } from './types';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Topic schema
 */
const TopicSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
});

/**
 * Action item schema
 */
const ActionItemSchema = z.object({
  text: z.string().min(1),
  assignee: z.string().nullable().optional().transform(val => val || undefined),
  dueDate: z.string().nullable().optional().transform(val => val || undefined),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

/**
 * Full summary output schema
 */
const SummaryOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  topics: z.array(TopicSchema).min(1),
  actionItems: z.array(ActionItemSchema).default([]),
  decisions: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).default('neutral'),
});

/**
 * Chunk summary schema (partial summary from a chunk)
 */
const ChunkSummarySchema = z.object({
  topics: z.array(TopicSchema).default([]),
  actionItems: z.array(ActionItemSchema).default([]),
  decisions: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  keyQuotes: z.array(z.string()).optional(),
});

/**
 * Action items only schema (for action item extraction)
 */
const ActionItemsOnlySchema = z.array(
  ActionItemSchema.extend({
    context: z.string().optional(),
  })
);

/**
 * Generic JSON schema for custom insights
 */
const GenericJsonSchema = z.record(z.unknown());

/**
 * Output parser class
 */
export class OutputParser {
  /**
   * Parse and validate summary output
   */
  parseSummary(rawOutput: string): SummaryOutput {
    const json = this.extractJson(rawOutput);

    try {
      const validated = SummaryOutputSchema.parse(json);

      // Transform to our types
      return {
        executiveSummary: validated.executiveSummary,
        topics: validated.topics as Topic[],
        actionItems: validated.actionItems as ActionItem[],
        decisions: validated.decisions,
        questions: validated.questions,
        sentiment: validated.sentiment,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        logger.error({ issues, rawOutput: rawOutput.slice(0, 500) }, 'Summary validation failed');
        throw new OutputParseError(`Invalid summary format: ${issues}`, rawOutput);
      }
      throw error;
    }
  }

  /**
   * Parse chunk summary output
   */
  parseChunkSummary(rawOutput: string): {
    topics: Topic[];
    actionItems: ActionItem[];
    decisions: string[];
    questions: string[];
    keyQuotes?: string[];
  } {
    const json = this.extractJson(rawOutput);

    try {
      const validated = ChunkSummarySchema.parse(json);
      return {
        topics: validated.topics as Topic[],
        actionItems: validated.actionItems as ActionItem[],
        decisions: validated.decisions,
        questions: validated.questions,
        keyQuotes: validated.keyQuotes,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        logger.error({ issues }, 'Chunk summary validation failed');
        throw new OutputParseError(`Invalid chunk summary format: ${issues}`, rawOutput);
      }
      throw error;
    }
  }

  /**
   * Parse action items only output
   */
  parseActionItems(rawOutput: string): Array<ActionItem & { context?: string }> {
    const json = this.extractJson(rawOutput);

    try {
      // Handle both array and object with actionItems key
      const data = Array.isArray(json) ? json : json.actionItems || [];
      const validated = ActionItemsOnlySchema.parse(data);
      return validated as Array<ActionItem & { context?: string }>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        logger.error({ issues }, 'Action items validation failed');
        throw new OutputParseError(`Invalid action items format: ${issues}`, rawOutput);
      }
      throw error;
    }
  }

  /**
   * Parse custom insight output
   */
  parseInsight(rawOutput: string, templateId: string, templateName: string): InsightResult {
    const json = this.extractJson(rawOutput);

    try {
      // Validate it's valid JSON but don't enforce specific schema
      GenericJsonSchema.parse(json);

      return {
        templateId,
        templateName,
        content: json,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ templateId }, 'Insight validation failed');
        throw new OutputParseError(`Invalid insight format`, rawOutput);
      }
      throw error;
    }
  }

  /**
   * Extract JSON from LLM output
   * Handles common issues like markdown code blocks, leading/trailing text
   */
  extractJson(rawOutput: string): Record<string, unknown> | unknown[] {
    let text = rawOutput.trim();

    // Remove markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }

    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }

    text = text.trim();

    // Try to find JSON object or array
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch && jsonMatch[1]) {
      text = jsonMatch[1];
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      logger.error({ rawOutput: rawOutput.slice(0, 500) }, 'Failed to parse JSON from output');
      throw new OutputParseError('Could not parse JSON from LLM output', rawOutput);
    }
  }

  /**
   * Validate and sanitize action item
   */
  sanitizeActionItem(item: Partial<ActionItem>): ActionItem {
    return {
      text: (item.text || '').trim(),
      assignee: item.assignee?.trim() || undefined,
      dueDate: item.dueDate?.trim() || undefined,
      priority: item.priority || 'medium',
    };
  }

  /**
   * Merge action items from multiple chunks (deduplicate)
   */
  mergeActionItems(items: ActionItem[]): ActionItem[] {
    const seen = new Map<string, ActionItem>();

    for (const item of items) {
      const key = item.text.toLowerCase().trim();

      if (!seen.has(key)) {
        seen.set(key, item);
      } else {
        // Merge assignee and priority if missing
        const existing = seen.get(key)!;
        if (!existing.assignee && item.assignee) {
          existing.assignee = item.assignee;
        }
        if (!existing.dueDate && item.dueDate) {
          existing.dueDate = item.dueDate;
        }
        // Keep higher priority
        if (item.priority === 'high' || (item.priority === 'medium' && existing.priority === 'low')) {
          existing.priority = item.priority;
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Merge topics from multiple chunks
   */
  mergeTopics(topics: Topic[]): Topic[] {
    const merged = new Map<string, Topic>();

    for (const topic of topics) {
      const key = topic.title.toLowerCase().trim();

      if (!merged.has(key)) {
        merged.set(key, { ...topic, keyPoints: [...topic.keyPoints] });
      } else {
        // Merge key points
        const existing = merged.get(key)!;
        existing.summary = `${existing.summary} ${topic.summary}`;
        existing.keyPoints.push(...topic.keyPoints);
      }
    }

    // Deduplicate key points within each topic
    for (const topic of merged.values()) {
      topic.keyPoints = [...new Set(topic.keyPoints)];
    }

    return Array.from(merged.values());
  }

  /**
   * Deduplicate string arrays
   */
  deduplicateStrings(items: string[]): string[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Create empty summary (for fallback)
   */
  createEmptySummary(): SummaryOutput {
    return {
      executiveSummary: 'Summary generation failed. Please try again.',
      topics: [{ title: 'Unable to Generate', summary: 'The summary could not be generated.', keyPoints: [] }],
      actionItems: [],
      decisions: [],
      questions: [],
      sentiment: 'neutral',
    };
  }
}

// Export singleton instance
export const outputParser = new OutputParser();

// Export schemas for testing
export { SummaryOutputSchema, ActionItemSchema, TopicSchema, ChunkSummarySchema };
