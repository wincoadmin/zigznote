import { deepgramService } from '../src/deepgramService';
import type { DeepgramResponse } from '../src/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DeepgramService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  const mockDeepgramResponse: DeepgramResponse = {
    metadata: {
      request_id: 'req-123',
      sha256: 'abc123',
      created: '2024-01-01T12:00:00Z',
      duration: 3600,
      channels: 1,
      models: ['nova-2'],
      model_info: {},
    },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: 'Hello world. This is a test.',
              confidence: 0.95,
              words: [
                { word: 'hello', start: 0, end: 0.5, confidence: 0.98, speaker: 0, punctuated_word: 'Hello' },
                { word: 'world', start: 0.5, end: 1.0, confidence: 0.97, speaker: 0, punctuated_word: 'world.' },
                { word: 'this', start: 1.5, end: 1.8, confidence: 0.96, speaker: 1, punctuated_word: 'This' },
                { word: 'is', start: 1.8, end: 2.0, confidence: 0.99, speaker: 1, punctuated_word: 'is' },
                { word: 'a', start: 2.0, end: 2.1, confidence: 0.99, speaker: 1, punctuated_word: 'a' },
                { word: 'test', start: 2.1, end: 2.5, confidence: 0.95, speaker: 1, punctuated_word: 'test.' },
              ],
            },
          ],
        },
      ],
      utterances: [
        {
          start: 0,
          end: 1.0,
          confidence: 0.975,
          channel: 0,
          transcript: 'Hello world.',
          words: [
            { word: 'hello', start: 0, end: 0.5, confidence: 0.98, speaker: 0 },
            { word: 'world', start: 0.5, end: 1.0, confidence: 0.97, speaker: 0 },
          ],
          speaker: 0,
          id: 'utt-1',
        },
        {
          start: 1.5,
          end: 2.5,
          confidence: 0.9725,
          channel: 0,
          transcript: 'This is a test.',
          words: [
            { word: 'this', start: 1.5, end: 1.8, confidence: 0.96, speaker: 1 },
            { word: 'is', start: 1.8, end: 2.0, confidence: 0.99, speaker: 1 },
            { word: 'a', start: 2.0, end: 2.1, confidence: 0.99, speaker: 1 },
            { word: 'test', start: 2.1, end: 2.5, confidence: 0.95, speaker: 1 },
          ],
          speaker: 1,
          id: 'utt-2',
        },
      ],
    },
  };

  describe('transcribeUrl', () => {
    it('should submit audio URL to Deepgram', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepgramResponse,
      });

      const result = await deepgramService.transcribeUrl('https://example.com/audio.mp3');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listen'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('https://example.com/audio.mp3'),
        })
      );

      expect(result).toBeDefined();
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('should pass diarization options correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepgramResponse,
      });

      await deepgramService.transcribeUrl('https://example.com/audio.mp3', {
        diarize: true,
        punctuate: true,
        language: 'en',
      });

      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;

      expect(url).toContain('diarize=true');
      expect(url).toContain('punctuate=true');
      expect(url).toContain('language=en');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid audio URL',
      });

      await expect(
        deepgramService.transcribeUrl('https://example.com/audio.mp3')
      ).rejects.toThrow('Deepgram API error');
    });
  });

  describe('processResults', () => {
    it('should parse results correctly', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      expect(result.durationMs).toBe(3600000);
      expect(result.language).toBe('en');
      expect(result.segments.length).toBe(2);
      expect(result.speakers.length).toBe(2);
    });

    it('should extract speakers from utterances', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      expect(result.speakers[0].label).toBe('Speaker 1');
      expect(result.speakers[1].label).toBe('Speaker 2');
    });

    it('should format segments correctly', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      const segment = result.segments[0];
      expect(segment.speaker).toBe('Speaker 1');
      expect(segment.text).toBe('Hello world.');
      expect(segment.startMs).toBe(0);
      expect(segment.endMs).toBe(1000);
    });

    it('should calculate average confidence', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      expect(result.averageConfidence).toBeGreaterThan(0);
      expect(result.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should set quality warning for low confidence', () => {
      const lowConfidenceResponse = {
        ...mockDeepgramResponse,
        results: {
          ...mockDeepgramResponse.results,
          utterances: mockDeepgramResponse.results.utterances?.map((u) => ({
            ...u,
            confidence: 0.5,
          })),
        },
      };

      const result = deepgramService.processResults(lowConfidenceResponse, 'en');
      expect(result.qualityWarning).toBe(true);
    });

    it('should generate full text', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      expect(result.fullText).toContain('Hello world.');
      expect(result.fullText).toContain('This is a test.');
    });

    it('should count words correctly', () => {
      const result = deepgramService.processResults(mockDeepgramResponse, 'en');

      expect(result.wordCount).toBe(6);
    });
  });

  describe('extractSpeakers', () => {
    it('should extract speakers from response', () => {
      const speakers = deepgramService.extractSpeakers(mockDeepgramResponse);

      expect(speakers.length).toBe(2);
      expect(speakers[0].id).toBe('speaker_0');
      expect(speakers[1].id).toBe('speaker_1');
    });

    it('should calculate speaking time per speaker', () => {
      const speakers = deepgramService.extractSpeakers(mockDeepgramResponse);

      expect(speakers[0].totalSpeakingTimeMs).toBeGreaterThan(0);
      expect(speakers[1].totalSpeakingTimeMs).toBeGreaterThan(0);
    });

    it('should handle empty response', () => {
      const emptyResponse: DeepgramResponse = {
        ...mockDeepgramResponse,
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0, words: [] }] }],
          utterances: [],
        },
      };

      const speakers = deepgramService.extractSpeakers(emptyResponse);
      expect(speakers).toEqual([]);
    });
  });
});
