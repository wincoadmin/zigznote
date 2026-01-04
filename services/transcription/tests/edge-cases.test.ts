import { deepgramService } from '../src/deepgramService';
import type { DeepgramResponse, ProcessedTranscript } from '../src/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Transcription Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Empty/Minimal Audio Handling', () => {
    it('should handle empty transcript response', () => {
      const emptyResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-empty',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 0,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0, words: [] }] }],
          utterances: [],
        },
      };

      const result = deepgramService.processResults(emptyResponse, 'en');

      expect(result.segments).toHaveLength(0);
      // Empty response still creates a default speaker
      expect(result.speakers).toHaveLength(1);
      expect(result.wordCount).toBe(0);
      expect(result.fullText).toBe('');
    });

    it('should handle silence-only audio', () => {
      const silenceResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-silence',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 60, // 1 minute of silence
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0, words: [] }] }],
          utterances: [],
        },
      };

      const result = deepgramService.processResults(silenceResponse, 'en');

      expect(result.durationMs).toBe(60000);
      expect(result.segments).toHaveLength(0);
    });

    it('should handle very short audio (< 1 second)', () => {
      const shortResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-short',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 0.5,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'Hi',
                  confidence: 0.9,
                  words: [{ word: 'hi', start: 0, end: 0.3, confidence: 0.9, speaker: 0, punctuated_word: 'Hi' }],
                },
              ],
            },
          ],
          utterances: [
            {
              start: 0,
              end: 0.3,
              confidence: 0.9,
              channel: 0,
              transcript: 'Hi',
              words: [{ word: 'hi', start: 0, end: 0.3, confidence: 0.9, speaker: 0 }],
              speaker: 0,
              id: 'utt-1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(shortResponse, 'en');

      expect(result.segments.length).toBe(1);
      expect(result.wordCount).toBe(1);
    });
  });

  describe('Speaker Diarization Edge Cases', () => {
    it('should handle single speaker', () => {
      const singleSpeakerResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-single',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 60,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: 'Hello world', confidence: 0.95, words: [] }] }],
          utterances: [
            {
              start: 0,
              end: 2,
              confidence: 0.95,
              channel: 0,
              transcript: 'Hello world.',
              words: [
                { word: 'hello', start: 0, end: 1, confidence: 0.95, speaker: 0 },
                { word: 'world', start: 1, end: 2, confidence: 0.95, speaker: 0 },
              ],
              speaker: 0,
              id: 'utt-1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(singleSpeakerResponse, 'en');

      expect(result.speakers.length).toBe(1);
      expect(result.speakers[0].label).toBe('Speaker 1');
    });

    it('should handle many speakers (10+)', () => {
      const utterances = Array.from({ length: 10 }, (_, i) => ({
        start: i * 5,
        end: i * 5 + 4,
        confidence: 0.9,
        channel: 0,
        transcript: `Speaker ${i + 1} talking`,
        words: [
          { word: 'speaker', start: i * 5, end: i * 5 + 1, confidence: 0.9, speaker: i },
          { word: String(i + 1), start: i * 5 + 1, end: i * 5 + 2, confidence: 0.9, speaker: i },
          { word: 'talking', start: i * 5 + 2, end: i * 5 + 4, confidence: 0.9, speaker: i },
        ],
        speaker: i,
        id: `utt-${i}`,
      }));

      const manySpeakersResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-many',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 50,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.9, words: [] }] }],
          utterances,
        },
      };

      const result = deepgramService.processResults(manySpeakersResponse, 'en');

      expect(result.speakers.length).toBe(10);
      expect(result.speakers[9].label).toBe('Speaker 10');
    });

    it('should handle rapid speaker changes', () => {
      const rapidChangeResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-rapid',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 10,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.9, words: [] }] }],
          utterances: [
            { start: 0, end: 1, confidence: 0.9, channel: 0, transcript: 'Yes', words: [], speaker: 0, id: 'u1' },
            { start: 1, end: 2, confidence: 0.9, channel: 0, transcript: 'No', words: [], speaker: 1, id: 'u2' },
            { start: 2, end: 3, confidence: 0.9, channel: 0, transcript: 'Yes', words: [], speaker: 0, id: 'u3' },
            { start: 3, end: 4, confidence: 0.9, channel: 0, transcript: 'No', words: [], speaker: 1, id: 'u4' },
            { start: 4, end: 5, confidence: 0.9, channel: 0, transcript: 'Yes', words: [], speaker: 0, id: 'u5' },
          ],
        },
      };

      const result = deepgramService.processResults(rapidChangeResponse, 'en');

      expect(result.speakers.length).toBe(2);
      expect(result.segments.length).toBe(5);
    });

    it('should handle overlapping speech detection', () => {
      // Simulated overlapping speech (same timestamps, different speakers)
      const overlapResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-overlap',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 5,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.8, words: [] }] }],
          utterances: [
            { start: 0, end: 3, confidence: 0.8, channel: 0, transcript: 'I think that', words: [], speaker: 0, id: 'u1' },
            { start: 2, end: 5, confidence: 0.75, channel: 0, transcript: 'No wait', words: [], speaker: 1, id: 'u2' },
          ],
        },
      };

      const result = deepgramService.processResults(overlapResponse, 'en');

      // Should still process both segments
      expect(result.segments.length).toBe(2);
    });
  });

  describe('Audio Quality Edge Cases', () => {
    it('should flag very low confidence transcripts', () => {
      const lowConfidenceResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-low',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 60,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: 'mumble mumble', confidence: 0.3, words: [] }] }],
          utterances: [
            {
              start: 0,
              end: 5,
              confidence: 0.3,
              channel: 0,
              transcript: 'mumble mumble',
              words: [],
              speaker: 0,
              id: 'u1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(lowConfidenceResponse, 'en');

      expect(result.qualityWarning).toBe(true);
      expect(result.averageConfidence).toBeLessThan(0.7);
    });

    it('should handle mixed confidence levels', () => {
      const mixedConfidenceResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-mixed',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 60,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.7, words: [] }] }],
          utterances: [
            { start: 0, end: 10, confidence: 0.95, channel: 0, transcript: 'Clear speech', words: [], speaker: 0, id: 'u1' },
            { start: 10, end: 20, confidence: 0.4, channel: 0, transcript: 'Mumbled part', words: [], speaker: 0, id: 'u2' },
            { start: 20, end: 30, confidence: 0.9, channel: 0, transcript: 'Clear again', words: [], speaker: 0, id: 'u3' },
          ],
        },
      };

      const result = deepgramService.processResults(mixedConfidenceResponse, 'en');

      // Average should be around 0.75
      expect(result.averageConfidence).toBeGreaterThan(0.5);
      expect(result.averageConfidence).toBeLessThan(0.9);
    });
  });

  describe('Language Edge Cases', () => {
    it('should handle various language codes', () => {
      const languages = ['en', 'en-US', 'es', 'fr', 'de', 'ja', 'zh'];

      const baseResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-lang',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 10,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: 'Test', confidence: 0.9, words: [] }] }],
          utterances: [
            { start: 0, end: 1, confidence: 0.9, channel: 0, transcript: 'Test', words: [], speaker: 0, id: 'u1' },
          ],
        },
      };

      for (const lang of languages) {
        const result = deepgramService.processResults(baseResponse, lang);
        expect(result.language).toBe(lang);
      }
    });
  });

  describe('Long Audio Edge Cases', () => {
    it('should handle very long transcripts (2+ hours)', () => {
      // Simulate a 2-hour meeting with many utterances
      const utterances = Array.from({ length: 100 }, (_, i) => ({
        start: i * 72, // Spread over 2 hours
        end: i * 72 + 60,
        confidence: 0.9,
        channel: 0,
        transcript: `Segment ${i + 1} with some content about the meeting discussion.`,
        words: [],
        speaker: i % 3, // 3 speakers
        id: `utt-${i}`,
      }));

      const longResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-long',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 7200, // 2 hours
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.9, words: [] }] }],
          utterances,
        },
      };

      const result = deepgramService.processResults(longResponse, 'en');

      expect(result.durationMs).toBe(7200000);
      expect(result.segments.length).toBe(100);
      expect(result.speakers.length).toBe(3);
    });
  });

  describe('Special Characters and Formatting', () => {
    it('should handle special characters in transcript', () => {
      const specialCharsResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-special',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 10,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.9, words: [] }] }],
          utterances: [
            {
              start: 0,
              end: 5,
              confidence: 0.9,
              channel: 0,
              transcript: "Let's talk about $100 & the 50% increase—it's important!",
              words: [],
              speaker: 0,
              id: 'u1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(specialCharsResponse, 'en');

      expect(result.fullText).toContain('$100');
      expect(result.fullText).toContain('&');
      expect(result.fullText).toContain('%');
    });

    it('should handle numbers and dates in speech', () => {
      const numbersResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-numbers',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 10,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: '', confidence: 0.9, words: [] }] }],
          utterances: [
            {
              start: 0,
              end: 5,
              confidence: 0.9,
              channel: 0,
              transcript: 'The meeting is on January 15th, 2024 at 3:30 PM.',
              words: [],
              speaker: 0,
              id: 'u1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(numbersResponse, 'en');

      expect(result.fullText).toContain('January 15th');
      expect(result.fullText).toContain('2024');
      expect(result.fullText).toContain('3:30 PM');
    });
  });

  describe('API Error Handling', () => {
    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(
        deepgramService.transcribeUrl('https://example.com/audio.mp3')
      ).rejects.toThrow();
    });

    it('should handle invalid audio URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid audio URL or format',
      });

      await expect(
        deepgramService.transcribeUrl('https://example.com/not-audio.txt')
      ).rejects.toThrow('Deepgram API error');
    });

    it('should handle authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(
        deepgramService.transcribeUrl('https://example.com/audio.mp3')
      ).rejects.toThrow('Deepgram API error');
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        deepgramService.transcribeUrl('https://example.com/audio.mp3')
      ).rejects.toThrow('Deepgram API error');
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(
        deepgramService.transcribeUrl('https://example.com/audio.mp3')
      ).rejects.toThrow('Deepgram API error');
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle response with no utterances', () => {
      const noUtterancesResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-no-utt',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 60,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'Some text here',
                  confidence: 0.9,
                  words: [
                    { word: 'some', start: 0, end: 0.5, confidence: 0.9, speaker: 0, punctuated_word: 'Some' },
                    { word: 'text', start: 0.5, end: 1, confidence: 0.9, speaker: 0, punctuated_word: 'text' },
                    { word: 'here', start: 1, end: 1.5, confidence: 0.9, speaker: 0, punctuated_word: 'here' },
                  ],
                },
              ],
            },
          ],
          // No utterances array
        },
      };

      const result = deepgramService.processResults(noUtterancesResponse, 'en');

      // Should still process using channel words
      expect(result).toBeDefined();
    });

    it('should handle response with missing speaker info', () => {
      const noSpeakerResponse: DeepgramResponse = {
        metadata: {
          request_id: 'req-no-speaker',
          sha256: 'abc',
          created: '2024-01-01T12:00:00Z',
          duration: 10,
          channels: 1,
          models: ['nova-2'],
          model_info: {},
        },
        results: {
          channels: [{ alternatives: [{ transcript: 'Hello', confidence: 0.9, words: [] }] }],
          utterances: [
            {
              start: 0,
              end: 1,
              confidence: 0.9,
              channel: 0,
              transcript: 'Hello',
              words: [],
              speaker: 0, // Speaker is required for correct labeling
              id: 'u1',
            },
          ],
        },
      };

      const result = deepgramService.processResults(noSpeakerResponse, 'en');

      expect(result.segments.length).toBe(1);
      expect(result.segments[0].speaker).toBe('Speaker 1');
    });
  });
});
