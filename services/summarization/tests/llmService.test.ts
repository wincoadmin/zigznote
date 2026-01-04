/**
 * Tests for LLM Service
 */

import { LLMService } from '../src/llmService';
import { AI_MODELS } from '@zigznote/shared';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('LLMService', () => {
  describe('selectModel', () => {
    it('should select GPT-4o-mini for short transcripts (< 5000 words)', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      const selection = service.selectModel(3000);

      expect(selection.provider).toBe('openai');
      expect(selection.model).toBe(AI_MODELS.GPT_4O_MINI);
      expect(selection.reason).toContain('3000 words');
    });

    it('should select Claude for long transcripts (>= 5000 words)', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      const selection = service.selectModel(6000);

      expect(selection.provider).toBe('anthropic');
      expect(selection.model).toBe(AI_MODELS.CLAUDE_SONNET);
      expect(selection.reason).toContain('6000 words');
    });

    it('should select Claude when forced', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      const selection = service.selectModel(100, 'claude');

      expect(selection.provider).toBe('anthropic');
      expect(selection.model).toBe(AI_MODELS.CLAUDE_SONNET);
      expect(selection.reason).toBe('User requested Claude');
    });

    it('should select GPT when forced', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      const selection = service.selectModel(10000, 'gpt');

      expect(selection.provider).toBe('openai');
      expect(selection.model).toBe(AI_MODELS.GPT_4O_MINI);
      expect(selection.reason).toBe('User requested GPT');
    });

    it('should fallback to Anthropic when only Anthropic key available', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      delete process.env.OPENAI_API_KEY;

      const service = new LLMService();
      const selection = service.selectModel(100);

      expect(selection.provider).toBe('anthropic');
      expect(selection.reason).toContain('Only Anthropic');
    });

    it('should fallback to OpenAI when only OpenAI key available', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      const selection = service.selectModel(10000);

      expect(selection.provider).toBe('openai');
      expect(selection.reason).toContain('Only OpenAI');
    });

    it('should throw error when no API keys configured', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const service = new LLMService();

      expect(() => service.selectModel(1000)).toThrow('No LLM API keys configured');
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      const service = new LLMService();

      expect(service.countWords('Hello world')).toBe(2);
      expect(service.countWords('One two three four five')).toBe(5);
      expect(service.countWords('')).toBe(0);
      expect(service.countWords('   ')).toBe(0);
    });

    it('should handle multiple spaces and newlines', () => {
      const service = new LLMService();

      expect(service.countWords('Hello   world')).toBe(2);
      expect(service.countWords('Hello\nworld')).toBe(2);
      expect(service.countWords('Hello\n\n\nworld')).toBe(2);
    });
  });

  describe('needsChunking', () => {
    it('should return true for transcripts over chunk threshold', () => {
      const service = new LLMService({ maxWordsPerChunk: 4000 });

      expect(service.needsChunking(5000)).toBe(true);
      expect(service.needsChunking(10000)).toBe(true);
    });

    it('should return false for transcripts under chunk threshold', () => {
      const service = new LLMService({ maxWordsPerChunk: 4000 });

      expect(service.needsChunking(3000)).toBe(false);
      expect(service.needsChunking(4000)).toBe(false);
    });
  });

  describe('chunkTranscript', () => {
    it('should split transcript into chunks', () => {
      const service = new LLMService({ maxWordsPerChunk: 3 });
      const transcript = 'one two three four five six seven';

      const chunks = service.chunkTranscript(transcript);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('one two three');
      expect(chunks[1]).toBe('four five six');
      expect(chunks[2]).toBe('seven');
    });

    it('should handle transcript smaller than chunk size', () => {
      const service = new LLMService({ maxWordsPerChunk: 100 });
      const transcript = 'small transcript';

      const chunks = service.chunkTranscript(transcript);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('small transcript');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const service = new LLMService({
        modelSelectionThreshold: 3000,
        temperature: 0.5,
      });

      const config = service.getConfig();

      expect(config.modelSelectionThreshold).toBe(3000);
      expect(config.temperature).toBe(0.5);
    });

    it('should use default values when not specified', () => {
      const service = new LLMService();

      const config = service.getConfig();

      expect(config.modelSelectionThreshold).toBe(5000);
      expect(config.maxWordsPerChunk).toBe(4000);
      expect(config.temperature).toBe(0.3);
      expect(config.maxRetries).toBe(3);
    });
  });
});
