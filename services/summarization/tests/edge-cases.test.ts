/**
 * Edge case tests for summarization service
 */

import { LLMService } from '../src/llmService';
import { OutputParser } from '../src/outputParser';
import { OutputParseError } from '../src/types';

describe('Edge Cases', () => {
  describe('LLM Service Edge Cases', () => {
    it('should handle empty transcript', () => {
      const service = new LLMService();

      expect(service.countWords('')).toBe(0);
      expect(service.needsChunking(0)).toBe(false);
    });

    it('should handle transcript with only whitespace', () => {
      const service = new LLMService();

      expect(service.countWords('   \n\t  ')).toBe(0);
    });

    it('should handle extremely long words', () => {
      const service = new LLMService();
      const longWord = 'a'.repeat(10000);

      expect(service.countWords(longWord)).toBe(1);
    });

    it('should handle unicode characters in word count', () => {
      const service = new LLMService();
      const unicodeText = '你好 世界 Hello World';

      expect(service.countWords(unicodeText)).toBe(4);
    });

    it('should handle special characters', () => {
      const service = new LLMService();
      const specialText = 'Hello! @world #test $money';

      expect(service.countWords(specialText)).toBe(4);
    });

    it('should handle exactly at threshold boundary', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';

      const service = new LLMService({ modelSelectionThreshold: 5000 });

      // Exactly at threshold
      const atThreshold = service.selectModel(5000);
      expect(atThreshold.provider).toBe('anthropic');

      // Just below threshold
      const belowThreshold = service.selectModel(4999);
      expect(belowThreshold.provider).toBe('openai');
    });

    it('should chunk transcript at word boundaries', () => {
      const service = new LLMService({ maxWordsPerChunk: 5 });
      const transcript = 'one two three four five six seven eight nine ten';

      const chunks = service.chunkTranscript(transcript);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('one two three four five');
      expect(chunks[1]).toBe('six seven eight nine ten');
    });
  });

  describe('Output Parser Edge Cases', () => {
    it('should handle JSON with nested objects', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        topics: [
          {
            title: 'Nested',
            summary: 'Has nested data',
            keyPoints: ['Point with {"json": "in it"}'],
          },
        ],
        actionItems: [],
        decisions: [],
        questions: [],
        sentiment: 'neutral',
      });

      const result = parser.parseSummary(input);

      expect(result.topics[0].keyPoints[0]).toContain('json');
    });

    it('should handle very long executive summary', () => {
      const parser = new OutputParser();
      const longSummary = 'A'.repeat(5000);
      const input = JSON.stringify({
        executiveSummary: longSummary,
        topics: [{ title: 'T', summary: 'S', keyPoints: [] }],
      });

      const result = parser.parseSummary(input);

      expect(result.executiveSummary.length).toBe(5000);
    });

    it('should handle action items with special characters', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'Summary',
        topics: [{ title: 'Topic', summary: 'Summary', keyPoints: [] }],
        actionItems: [
          {
            text: 'Review code at https://github.com/org/repo#123',
            assignee: "John O'Brien",
            dueDate: null,
            priority: 'high',
          },
        ],
      });

      const result = parser.parseSummary(input);

      expect(result.actionItems[0].text).toContain('github.com');
      expect(result.actionItems[0].assignee).toContain("O'Brien");
    });

    it('should handle empty arrays in all fields', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'No content',
        topics: [{ title: 'Empty', summary: 'No details', keyPoints: [] }],
        actionItems: [],
        decisions: [],
        questions: [],
        sentiment: 'neutral',
      });

      const result = parser.parseSummary(input);

      expect(result.actionItems).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.questions).toEqual([]);
    });

    it('should handle malformed JSON with extra commas', () => {
      const parser = new OutputParser();
      // JSON with trailing comma (invalid but common)
      const input = '{"executiveSummary": "Test",}';

      expect(() => parser.extractJson(input)).toThrow(OutputParseError);
    });

    it('should handle JSON with escaped quotes', () => {
      const parser = new OutputParser();
      const input = JSON.stringify({
        executiveSummary: 'He said "hello" to everyone',
        topics: [{ title: 'Quote', summary: 'Test "quotes"', keyPoints: [] }],
      });

      const result = parser.parseSummary(input);

      expect(result.executiveSummary).toContain('"hello"');
    });

    it('should handle multiple code block markers', () => {
      const parser = new OutputParser();
      const input = '```json\n```json\n{"key": "value"}\n```\n```';

      // This is ambiguous but should extract the JSON
      const result = parser.extractJson(input);

      expect(result).toEqual({ key: 'value' });
    });

    it('should handle sentiment values case insensitively through Zod', () => {
      const parser = new OutputParser();
      // Zod will fail on 'POSITIVE' as it expects lowercase
      const input = JSON.stringify({
        executiveSummary: 'Test',
        topics: [{ title: 'T', summary: 'S', keyPoints: [] }],
        sentiment: 'POSITIVE',
      });

      expect(() => parser.parseSummary(input)).toThrow(OutputParseError);
    });

    it('should handle priority values correctly', () => {
      const parser = new OutputParser();
      const input = JSON.stringify([
        { text: 'High priority', priority: 'high' },
        { text: 'Medium priority', priority: 'medium' },
        { text: 'Low priority', priority: 'low' },
      ]);

      const result = parser.parseActionItems(input);

      expect(result[0].priority).toBe('high');
      expect(result[1].priority).toBe('medium');
      expect(result[2].priority).toBe('low');
    });

    it('should default priority to medium if invalid', () => {
      const parser = new OutputParser();
      const input = JSON.stringify([{ text: 'Action', priority: 'urgent' }]);

      // Zod should fail on invalid priority
      expect(() => parser.parseActionItems(input)).toThrow();
    });
  });

  describe('Merge Logic Edge Cases', () => {
    it('should handle case-insensitive topic merging', () => {
      const parser = new OutputParser();
      const topics = [
        { title: 'Budget Discussion', summary: 'First', keyPoints: ['A'] },
        { title: 'budget discussion', summary: 'Second', keyPoints: ['B'] },
        { title: 'BUDGET DISCUSSION', summary: 'Third', keyPoints: ['C'] },
      ];

      const merged = parser.mergeTopics(topics);

      expect(merged.length).toBe(1);
      expect(merged[0].keyPoints.length).toBe(3);
    });

    it('should handle action items with only text', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action 1', priority: 'medium' as const },
        { text: 'action 1', priority: 'low' as const }, // Should be deduplicated
      ];

      const merged = parser.mergeActionItems(items);

      expect(merged.length).toBe(1);
    });

    it('should preserve first occurrence priority unless upgraded', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action', priority: 'medium' as const },
        { text: 'Action', priority: 'low' as const }, // Lower, should not upgrade
      ];

      const merged = parser.mergeActionItems(items);

      expect(merged[0].priority).toBe('medium');
    });

    it('should upgrade priority from low to medium', () => {
      const parser = new OutputParser();
      const items = [
        { text: 'Action', priority: 'low' as const },
        { text: 'Action', priority: 'medium' as const },
      ];

      const merged = parser.mergeActionItems(items);

      expect(merged[0].priority).toBe('medium');
    });

    it('should handle empty input arrays', () => {
      const parser = new OutputParser();

      expect(parser.mergeActionItems([])).toEqual([]);
      expect(parser.mergeTopics([])).toEqual([]);
      expect(parser.deduplicateStrings([])).toEqual([]);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should include raw output in parse error', () => {
      const parser = new OutputParser();

      try {
        parser.parseSummary('invalid json');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OutputParseError);
        expect((error as OutputParseError).rawOutput).toBe('invalid json');
      }
    });

    it('should create valid empty summary', () => {
      const parser = new OutputParser();
      const empty = parser.createEmptySummary();

      // Validate it would pass our schema
      expect(empty.executiveSummary.length).toBeGreaterThan(0);
      expect(empty.topics.length).toBeGreaterThan(0);
      expect(['positive', 'neutral', 'negative', 'mixed']).toContain(empty.sentiment);
    });

    it('should handle sanitizeActionItem with minimal data', () => {
      const parser = new OutputParser();
      const item = parser.sanitizeActionItem({});

      expect(item.text).toBe('');
      expect(item.assignee).toBeUndefined();
      expect(item.dueDate).toBeUndefined();
      expect(item.priority).toBe('medium');
    });

    it('should trim whitespace in sanitizeActionItem', () => {
      const parser = new OutputParser();
      const item = parser.sanitizeActionItem({
        text: '  Action item  ',
        assignee: '  John  ',
        dueDate: '  2024-01-15  ',
        priority: 'high',
      });

      expect(item.text).toBe('Action item');
      expect(item.assignee).toBe('John');
      expect(item.dueDate).toBe('2024-01-15');
    });
  });
});
