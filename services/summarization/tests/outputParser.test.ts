/**
 * Tests for Output Parser
 */

import { OutputParser, outputParser } from '../src/outputParser';
import { OutputParseError } from '../src/types';

describe('OutputParser', () => {
  describe('extractJson', () => {
    it('should parse valid JSON object', () => {
      const parser = new OutputParser();
      const input = '{"key": "value"}';

      const result = parser.extractJson(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should parse valid JSON array', () => {
      const parser = new OutputParser();
      const input = '[1, 2, 3]';

      const result = parser.extractJson(input);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle markdown code blocks', () => {
      const parser = new OutputParser();
      const input = '```json\n{"key": "value"}\n```';

      const result = parser.extractJson(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should handle generic code blocks', () => {
      const parser = new OutputParser();
      const input = '```\n{"key": "value"}\n```';

      const result = parser.extractJson(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from surrounding text', () => {
      const parser = new OutputParser();
      const input = 'Here is the JSON: {"key": "value"} as requested.';

      const result = parser.extractJson(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should throw OutputParseError for invalid JSON', () => {
      const parser = new OutputParser();
      const input = 'not valid json';

      expect(() => parser.extractJson(input)).toThrow(OutputParseError);
    });
  });

  describe('parseSummary', () => {
    it('should parse valid summary output', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'This is the summary.',
        topics: [
          {
            title: 'Topic 1',
            summary: 'Topic summary',
            keyPoints: ['Point 1', 'Point 2'],
          },
        ],
        actionItems: [
          {
            text: 'Do something',
            assignee: 'John',
            dueDate: '2024-01-15',
            priority: 'high',
          },
        ],
        decisions: ['Decision 1'],
        questions: ['Question 1'],
        sentiment: 'positive',
      });

      const result = parser.parseSummary(input);

      expect(result.executiveSummary).toBe('This is the summary.');
      expect(result.topics.length).toBe(1);
      expect(result.topics[0].title).toBe('Topic 1');
      expect(result.actionItems.length).toBe(1);
      expect(result.actionItems[0].priority).toBe('high');
      expect(result.sentiment).toBe('positive');
    });

    it('should use default values for optional fields', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        topics: [{ title: 'Topic', summary: 'Summary' }],
      });

      const result = parser.parseSummary(input);

      expect(result.actionItems).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.questions).toEqual([]);
      expect(result.sentiment).toBe('neutral');
    });

    it('should handle null assignee in action items', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        topics: [{ title: 'Topic', summary: 'Summary', keyPoints: [] }],
        actionItems: [
          {
            text: 'Action',
            assignee: null,
            dueDate: null,
            priority: 'medium',
          },
        ],
        decisions: [],
        questions: [],
        sentiment: 'neutral',
      });

      const result = parser.parseSummary(input);

      expect(result.actionItems[0].assignee).toBeUndefined();
      expect(result.actionItems[0].dueDate).toBeUndefined();
    });

    it('should throw error for missing required fields', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        // missing topics
      });

      expect(() => parser.parseSummary(input)).toThrow(OutputParseError);
    });

    it('should throw error for empty topics array', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        topics: [],
      });

      expect(() => parser.parseSummary(input)).toThrow(OutputParseError);
    });
  });

  describe('parseChunkSummary', () => {
    it('should parse valid chunk summary', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        topics: [{ title: 'Topic', summary: 'Summary', keyPoints: [] }],
        actionItems: [],
        decisions: ['Decision'],
        questions: ['Question'],
        keyQuotes: ['Quote 1'],
      });

      const result = parser.parseChunkSummary(input);

      expect(result.topics.length).toBe(1);
      expect(result.decisions).toEqual(['Decision']);
      expect(result.keyQuotes).toEqual(['Quote 1']);
    });

    it('should handle empty chunk', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({});

      const result = parser.parseChunkSummary(input);

      expect(result.topics).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.questions).toEqual([]);
    });
  });

  describe('parseActionItems', () => {
    it('should parse action items array', () => {
      const parser = new OutputParser();
      const input = JSON.stringify([
        { text: 'Action 1', assignee: 'John', priority: 'high' },
        { text: 'Action 2', priority: 'low' },
      ]);

      const result = parser.parseActionItems(input);

      expect(result.length).toBe(2);
      expect(result[0].text).toBe('Action 1');
      expect(result[0].assignee).toBe('John');
      expect(result[1].priority).toBe('low');
    });

    it('should handle object with actionItems key', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        actionItems: [{ text: 'Action', priority: 'medium' }],
      });

      const result = parser.parseActionItems(input);

      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Action');
    });
  });

  describe('mergeActionItems', () => {
    it('should deduplicate action items by text', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action 1', priority: 'medium' as const },
        { text: 'Action 1', priority: 'high' as const },
        { text: 'Action 2', priority: 'low' as const },
      ];

      const result = parser.mergeActionItems(items);

      expect(result.length).toBe(2);
    });

    it('should merge assignee from duplicates', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action 1', priority: 'medium' as const },
        { text: 'Action 1', assignee: 'John', priority: 'medium' as const },
      ];

      const result = parser.mergeActionItems(items);

      expect(result.length).toBe(1);
      expect(result[0].assignee).toBe('John');
    });

    it('should keep higher priority when merging', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action 1', priority: 'low' as const },
        { text: 'Action 1', priority: 'high' as const },
      ];

      const result = parser.mergeActionItems(items);

      expect(result[0].priority).toBe('high');
    });
  });

  describe('mergeTopics', () => {
    it('should merge topics with same title', () => {
      const parser = new OutputParser();
      const topics = [
        { title: 'Topic 1', summary: 'First summary', keyPoints: ['Point 1'] },
        { title: 'Topic 1', summary: 'Second summary', keyPoints: ['Point 2'] },
        { title: 'Topic 2', summary: 'Other topic', keyPoints: [] },
      ];

      const result = parser.mergeTopics(topics);

      expect(result.length).toBe(2);
      const topic1 = result.find((t) => t.title.toLowerCase() === 'topic 1');
      expect(topic1?.keyPoints).toContain('Point 1');
      expect(topic1?.keyPoints).toContain('Point 2');
    });

    it('should deduplicate key points within merged topic', () => {
      const parser = new OutputParser();
      const topics = [
        { title: 'Topic', summary: 'Summary 1', keyPoints: ['Point 1', 'Point 2'] },
        { title: 'Topic', summary: 'Summary 2', keyPoints: ['Point 2', 'Point 3'] },
      ];

      const result = parser.mergeTopics(topics);

      expect(result.length).toBe(1);
      expect(result[0].keyPoints.length).toBe(3);
    });
  });

  describe('deduplicateStrings', () => {
    it('should remove duplicate strings', () => {
      const parser = new OutputParser();
      const items = ['One', 'Two', 'one', 'THREE', 'three'];

      const result = parser.deduplicateStrings(items);

      expect(result.length).toBe(3);
    });

    it('should preserve order', () => {
      const parser = new OutputParser();
      const items = ['First', 'Second', 'first'];

      const result = parser.deduplicateStrings(items);

      expect(result[0]).toBe('First');
      expect(result[1]).toBe('Second');
    });
  });

  describe('createEmptySummary', () => {
    it('should create a valid empty summary structure', () => {
      const parser = new OutputParser();
      const empty = parser.createEmptySummary();

      expect(empty.executiveSummary).toBeDefined();
      expect(empty.topics.length).toBeGreaterThan(0);
      expect(Array.isArray(empty.actionItems)).toBe(true);
      expect(Array.isArray(empty.decisions)).toBe(true);
      expect(Array.isArray(empty.questions)).toBe(true);
      expect(empty.sentiment).toBe('neutral');
    });
  });
});
