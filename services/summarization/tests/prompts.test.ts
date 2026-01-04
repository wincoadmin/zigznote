/**
 * Tests for Prompt Builders
 */

import {
  buildSummaryPrompt,
  buildChunkPrompt,
  buildConsolidationPrompt,
  buildActionItemPrompt,
  PROMPT_VERSION,
} from '../src/prompts/summary';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_CHUNKED, SYSTEM_PROMPT_INSIGHTS } from '../src/prompts/system';
import {
  buildInsightPrompt,
  getBuiltInTemplate,
  validateTemplate,
  BUILT_IN_TEMPLATES,
} from '../src/prompts/insights';

describe('Summary Prompts', () => {
  describe('buildSummaryPrompt', () => {
    it('should include transcript in prompt', () => {
      const prompt = buildSummaryPrompt({
        transcript: 'Hello, this is a test transcript.',
      });

      expect(prompt).toContain('Hello, this is a test transcript.');
      expect(prompt).toContain('TRANSCRIPT START');
      expect(prompt).toContain('TRANSCRIPT END');
    });

    it('should include meeting title when provided', () => {
      const prompt = buildSummaryPrompt({
        transcript: 'Test',
        meetingTitle: 'Weekly Standup',
      });

      expect(prompt).toContain('Meeting Title: Weekly Standup');
    });

    it('should include participants when provided', () => {
      const prompt = buildSummaryPrompt({
        transcript: 'Test',
        participants: ['Alice', 'Bob', 'Charlie'],
      });

      expect(prompt).toContain('Participants: Alice, Bob, Charlie');
    });

    it('should include duration when provided', () => {
      const prompt = buildSummaryPrompt({
        transcript: 'Test',
        meetingDuration: 1800, // 30 minutes in seconds
      });

      expect(prompt).toContain('Duration: 30 minutes');
    });

    it('should include JSON output instructions', () => {
      const prompt = buildSummaryPrompt({
        transcript: 'Test',
      });

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('executiveSummary');
      expect(prompt).toContain('actionItems');
    });
  });

  describe('buildChunkPrompt', () => {
    it('should include chunk index information', () => {
      const prompt = buildChunkPrompt('Chunk content', 0, 3, {});

      expect(prompt).toContain('chunk 1 of 3');
    });

    it('should include chunk content', () => {
      const prompt = buildChunkPrompt('This is the chunk content', 0, 3, {});

      expect(prompt).toContain('This is the chunk content');
      expect(prompt).toContain('CHUNK START');
      expect(prompt).toContain('CHUNK END');
    });

    it('should include meeting title when provided', () => {
      const prompt = buildChunkPrompt('Content', 0, 2, {
        meetingTitle: 'Team Meeting',
      });

      expect(prompt).toContain('Meeting: Team Meeting');
    });
  });

  describe('buildConsolidationPrompt', () => {
    it('should include chunk summaries as JSON', () => {
      const chunkSummaries = [
        { topics: [{ title: 'Topic 1', summary: 'Summary 1', keyPoints: [] }] },
        { topics: [{ title: 'Topic 2', summary: 'Summary 2', keyPoints: [] }] },
      ];

      const prompt = buildConsolidationPrompt(chunkSummaries, {});

      expect(prompt).toContain('Topic 1');
      expect(prompt).toContain('Topic 2');
      expect(prompt).toContain('CHUNK SUMMARIES');
    });

    it('should include consolidation instructions', () => {
      const prompt = buildConsolidationPrompt([], {});

      expect(prompt).toContain('Consolidate');
      expect(prompt).toContain('Merge');
      expect(prompt).toContain('deduplicate');
    });
  });

  describe('buildActionItemPrompt', () => {
    it('should include transcript', () => {
      const prompt = buildActionItemPrompt('Meeting transcript here');

      expect(prompt).toContain('Meeting transcript here');
    });

    it('should include action item detection phrases', () => {
      const prompt = buildActionItemPrompt('Test');

      expect(prompt).toContain('I will');
      expect(prompt).toContain('TODO');
      expect(prompt).toContain('Follow up');
    });
  });

  describe('PROMPT_VERSION', () => {
    it('should have a valid version format', () => {
      expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

describe('System Prompts', () => {
  describe('SYSTEM_PROMPT', () => {
    it('should define role as meeting analyst', () => {
      expect(SYSTEM_PROMPT).toContain('meeting analyst');
      expect(SYSTEM_PROMPT).toContain('zigznote');
    });

    it('should mention JSON output requirement', () => {
      expect(SYSTEM_PROMPT).toContain('JSON');
    });

    it('should mention core capabilities', () => {
      expect(SYSTEM_PROMPT).toContain('Summarize');
      expect(SYSTEM_PROMPT).toContain('action items');
      expect(SYSTEM_PROMPT).toContain('decisions');
    });
  });

  describe('SYSTEM_PROMPT_CHUNKED', () => {
    it('should mention partial transcript', () => {
      expect(SYSTEM_PROMPT_CHUNKED).toContain('portion');
      expect(SYSTEM_PROMPT_CHUNKED).toContain('chunk');
    });
  });

  describe('SYSTEM_PROMPT_INSIGHTS', () => {
    it('should mention specific insights', () => {
      expect(SYSTEM_PROMPT_INSIGHTS).toContain('specific insights');
      expect(SYSTEM_PROMPT_INSIGHTS).toContain('templates');
    });
  });
});

describe('Insight Templates', () => {
  describe('BUILT_IN_TEMPLATES', () => {
    it('should have multiple templates', () => {
      expect(BUILT_IN_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should have required fields for each template', () => {
      for (const template of BUILT_IN_TEMPLATES) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.prompt).toBeDefined();
        expect(template.outputSchema).toBeDefined();
      }
    });

    it('should include sales signals template', () => {
      const salesTemplate = BUILT_IN_TEMPLATES.find((t) => t.id === 'sales_signals');
      expect(salesTemplate).toBeDefined();
      expect(salesTemplate?.name).toBe('Sales Signals');
    });

    it('should include interview notes template', () => {
      const interviewTemplate = BUILT_IN_TEMPLATES.find((t) => t.id === 'interview_notes');
      expect(interviewTemplate).toBeDefined();
    });
  });

  describe('getBuiltInTemplate', () => {
    it('should return template by ID', () => {
      const template = getBuiltInTemplate('sales_signals');

      expect(template).toBeDefined();
      expect(template?.id).toBe('sales_signals');
    });

    it('should return undefined for unknown ID', () => {
      const template = getBuiltInTemplate('unknown_template');

      expect(template).toBeUndefined();
    });
  });

  describe('buildInsightPrompt', () => {
    it('should include template description and prompt', () => {
      const template = BUILT_IN_TEMPLATES[0];
      const prompt = buildInsightPrompt(template, 'Test transcript');

      expect(prompt).toContain(template.description);
      expect(prompt).toContain('Test transcript');
    });

    it('should include transcript markers', () => {
      const template = BUILT_IN_TEMPLATES[0];
      const prompt = buildInsightPrompt(template, 'Transcript content');

      expect(prompt).toContain('TRANSCRIPT');
      expect(prompt).toContain('Transcript content');
    });
  });

  describe('validateTemplate', () => {
    it('should return empty array for valid template', () => {
      const errors = validateTemplate({
        id: 'test_template',
        name: 'Test Template',
        description: 'A test template',
        prompt: 'Extract test information from the transcript',
        outputSchema: 'json',
      });

      expect(errors).toEqual([]);
    });

    it('should return errors for missing ID', () => {
      const errors = validateTemplate({
        name: 'Test',
        prompt: 'Test prompt here',
      });

      expect(errors).toContain('Template ID is required');
    });

    it('should return errors for missing name', () => {
      const errors = validateTemplate({
        id: 'test',
        prompt: 'Test prompt here',
      });

      expect(errors).toContain('Template name is required');
    });

    it('should return errors for short prompt', () => {
      const errors = validateTemplate({
        id: 'test',
        name: 'Test',
        prompt: 'Short',
      });

      expect(errors).toContain('Template prompt must be at least 10 characters');
    });

    it('should return errors for invalid output schema', () => {
      const errors = validateTemplate({
        id: 'test',
        name: 'Test',
        prompt: 'This is a long enough prompt',
        outputSchema: 'invalid' as any,
      });

      expect(errors).toContain('Output schema must be one of: text, list, table, json');
    });
  });
});
