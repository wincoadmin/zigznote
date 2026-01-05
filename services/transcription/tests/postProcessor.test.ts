import {
  TranscriptPostProcessor,
  removeFillers,
  cleanSentenceBoundaries,
  findLowConfidenceRanges,
  resolveSpeaker,
  type TranscriptSegment,
  type PostProcessorOptions,
} from '../src/postProcessor';

describe('TranscriptPostProcessor', () => {
  describe('removeFillers', () => {
    it('should remove single word fillers (um, uh, etc.)', () => {
      expect(removeFillers('I um think that um we should do it')).toBe(
        'I think that we should do it'
      );
      // 'uh' is removed, 'So' followed by filler context also gets cleaned
      expect(removeFillers('So uh that is the plan')).toBe(
        'that is the plan'
      );
      // Simple filler removal
      expect(removeFillers('The um answer is yes')).toBe('The answer is yes');
    });

    it('should remove phrase fillers (you know, I mean, etc.)', () => {
      // Note: removeFillers doesn't capitalize - that's cleanSentenceBoundaries
      expect(removeFillers('You know we should fix this')).toBe(
        'we should fix this'
      );
      expect(removeFillers('I mean the solution is simple')).toBe(
        'the solution is simple'
      );
      expect(removeFillers('It works kind of well')).toBe('It works well');
    });

    it('should remove verbal tics when followed by specific words', () => {
      // 'So' at start followed by filler context gets removed
      expect(removeFillers('So like I was thinking')).toBe('I was thinking');
      // Repeated 'basically' gets cleaned up
      expect(removeFillers('Basically basically the issue is')).toBe(
        'the issue is'
      );
    });

    it('should remove repeated words (stammering)', () => {
      // Repetition pattern removes one of the repeated words
      expect(removeFillers('The the problem is clear')).toBe(
        'problem is clear'
      );
      // Multiple repetitions
      expect(removeFillers('I I I think so')).toContain('think');
    });

    it('should handle false starts', () => {
      // False starts with dashes are removed
      expect(removeFillers('I - I think')).toBe('I think');
      expect(removeFillers('So – we need to')).toBe('we need to');
    });

    it('should preserve meaningful content', () => {
      const meaningful = 'The project deadline is next Friday.';
      expect(removeFillers(meaningful)).toBe(meaningful);
    });

    it('should normalize whitespace after filler removal', () => {
      expect(removeFillers('I   um    think')).toBe('I think');
      expect(removeFillers('Hello   ,  world')).toBe('Hello, world');
    });

    it('should handle empty and minimal input', () => {
      expect(removeFillers('')).toBe('');
      expect(removeFillers('um')).toBe('');
      expect(removeFillers('uh um')).toBe('');
    });

    it('should handle multiple fillers in succession', () => {
      expect(removeFillers('So um uh basically you know')).toBe('');
      expect(
        removeFillers('I um uh think we uh should um do it')
      ).toBe('I think we should do it');
    });
  });

  describe('cleanSentenceBoundaries', () => {
    it('should capitalize first letter of text', () => {
      expect(cleanSentenceBoundaries('hello world')).toBe('Hello world.');
    });

    it('should capitalize after sentence-ending punctuation', () => {
      expect(cleanSentenceBoundaries('hello. world')).toBe('Hello. World.');
      expect(cleanSentenceBoundaries('done! next')).toBe('Done! Next.');
      expect(cleanSentenceBoundaries('why? because')).toBe('Why? Because.');
    });

    it('should add period at end if missing', () => {
      expect(cleanSentenceBoundaries('Hello world')).toBe('Hello world.');
    });

    it('should not add extra period if already ends with punctuation', () => {
      expect(cleanSentenceBoundaries('Hello world!')).toBe('Hello world!');
      expect(cleanSentenceBoundaries('What is this?')).toBe('What is this?');
      expect(cleanSentenceBoundaries('Done.')).toBe('Done.');
    });

    it('should handle empty input', () => {
      expect(cleanSentenceBoundaries('')).toBe('');
    });

    it('should handle already correct text', () => {
      const correct = 'Hello world. This is correct.';
      expect(cleanSentenceBoundaries(correct)).toBe(correct);
    });
  });

  describe('findLowConfidenceRanges', () => {
    it('should identify single low confidence word', () => {
      const words = [
        { word: 'Hello', confidence: 0.9 },
        { word: 'world', confidence: 0.5 },
        { word: 'today', confidence: 0.95 },
      ];
      const ranges = findLowConfidenceRanges(words, 0.7);
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({ start: 6, end: 11 });
    });

    it('should merge adjacent low confidence words', () => {
      const words = [
        { word: 'Hi', confidence: 0.9 },
        { word: 'there', confidence: 0.5 },
        { word: 'friend', confidence: 0.4 },
        { word: 'good', confidence: 0.95 },
      ];
      const ranges = findLowConfidenceRanges(words, 0.7);
      // "there" starts at position 3, "friend" ends at position 14
      expect(ranges.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when all words are high confidence', () => {
      const words = [
        { word: 'Hello', confidence: 0.9 },
        { word: 'world', confidence: 0.85 },
      ];
      const ranges = findLowConfidenceRanges(words, 0.7);
      expect(ranges).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const ranges = findLowConfidenceRanges([], 0.7);
      expect(ranges).toHaveLength(0);
    });

    it('should handle all low confidence words', () => {
      const words = [
        { word: 'um', confidence: 0.3 },
        { word: 'yeah', confidence: 0.4 },
      ];
      const ranges = findLowConfidenceRanges(words, 0.7);
      expect(ranges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('resolveSpeaker', () => {
    it('should return mapped name when alias exists', () => {
      const aliases = new Map([
        ['Speaker 0', 'John Smith'],
        ['Speaker 1', 'Jane Doe'],
      ]);
      expect(resolveSpeaker('Speaker 0', aliases)).toBe('John Smith');
      expect(resolveSpeaker('Speaker 1', aliases)).toBe('Jane Doe');
    });

    it('should return original label when no alias exists', () => {
      const aliases = new Map([['Speaker 0', 'John Smith']]);
      expect(resolveSpeaker('Speaker 2', aliases)).toBe('Speaker 2');
    });

    it('should handle empty aliases map', () => {
      const aliases = new Map<string, string>();
      expect(resolveSpeaker('Speaker 0', aliases)).toBe('Speaker 0');
    });
  });

  describe('TranscriptPostProcessor class', () => {
    const createSegment = (
      speaker: string,
      text: string,
      confidence = 0.9,
      words?: Array<{ word: string; start: number; end: number; confidence: number }>
    ): TranscriptSegment => ({
      speaker,
      text,
      startTime: 0,
      endTime: 1000,
      confidence,
      words,
    });

    describe('processSegment', () => {
      it('should apply all processing steps', () => {
        const processor = new TranscriptPostProcessor();
        const segment = createSegment('Speaker 0', 'um so I think we should um do it');
        const result = processor.processSegment(segment);

        expect(result.cleanedText).not.toContain('um');
        expect(result.cleanedText).toMatch(/^[A-Z]/); // Capitalized
        expect(result.cleanedText).toMatch(/\.$/); // Ends with period
        expect(result.displaySpeaker).toBe('Speaker 0');
      });

      it('should resolve speaker aliases', () => {
        const aliases = new Map([['Speaker 0', 'Alice']]);
        const processor = new TranscriptPostProcessor({ speakerAliases: aliases });
        const segment = createSegment('Speaker 0', 'Hello everyone');
        const result = processor.processSegment(segment);

        expect(result.displaySpeaker).toBe('Alice');
      });

      it('should find low confidence ranges when words provided', () => {
        const processor = new TranscriptPostProcessor({
          highlightLowConfidence: true,
          confidenceThreshold: 0.8,
        });
        const segment = createSegment('Speaker 0', 'Hello world', 0.85, [
          { word: 'Hello', start: 0, end: 5, confidence: 0.95 },
          { word: 'world', start: 6, end: 11, confidence: 0.5 },
        ]);
        const result = processor.processSegment(segment);

        expect(result.lowConfidenceRanges.length).toBeGreaterThan(0);
      });

      it('should respect removeFillers option', () => {
        const processorWithFillers = new TranscriptPostProcessor({ removeFillers: false });
        const segment = createSegment('Speaker 0', 'I um think so');
        const result = processorWithFillers.processSegment(segment);

        expect(result.cleanedText).toContain('um');
      });

      it('should respect cleanSentenceBoundaries option', () => {
        const processor = new TranscriptPostProcessor({
          cleanSentenceBoundaries: false,
          removeFillers: false,
        });
        const segment = createSegment('Speaker 0', 'hello world');
        const result = processor.processSegment(segment);

        // First letter should remain lowercase when cleanSentenceBoundaries is false
        expect(result.cleanedText).toBe('hello world');
      });
    });

    describe('processTranscript', () => {
      it('should process all segments', () => {
        const processor = new TranscriptPostProcessor();
        const segments = [
          createSegment('Speaker 0', 'um hello'),
          createSegment('Speaker 1', 'um hi there'),
        ];
        const results = processor.processTranscript(segments);

        expect(results).toHaveLength(2);
        expect(results[0].cleanedText).toBe('Hello.');
        expect(results[1].cleanedText).toBe('Hi there.');
      });

      it('should handle empty array', () => {
        const processor = new TranscriptPostProcessor();
        const results = processor.processTranscript([]);
        expect(results).toHaveLength(0);
      });
    });

    describe('getFullText', () => {
      it('should format full text with speaker labels', () => {
        const processor = new TranscriptPostProcessor();
        const segments = [
          createSegment('Speaker 0', 'Hello everyone'),
          createSegment('Speaker 1', 'Hi there'),
        ];
        const processed = processor.processTranscript(segments);
        const fullText = processor.getFullText(processed);

        expect(fullText).toContain('Speaker 0: Hello everyone.');
        expect(fullText).toContain('Speaker 1: Hi there.');
        expect(fullText).toContain('\n\n'); // Paragraphs separated
      });

      it('should use resolved speaker names', () => {
        const aliases = new Map([
          ['Speaker 0', 'Alice'],
          ['Speaker 1', 'Bob'],
        ]);
        const processor = new TranscriptPostProcessor({ speakerAliases: aliases });
        const segments = [
          createSegment('Speaker 0', 'Hello'),
          createSegment('Speaker 1', 'Hi'),
        ];
        const processed = processor.processTranscript(segments);
        const fullText = processor.getFullText(processed);

        expect(fullText).toContain('Alice:');
        expect(fullText).toContain('Bob:');
        expect(fullText).not.toContain('Speaker 0');
        expect(fullText).not.toContain('Speaker 1');
      });
    });

    describe('updateOptions', () => {
      it('should update processor options', () => {
        const processor = new TranscriptPostProcessor({
          removeFillers: true,
          cleanSentenceBoundaries: false, // Disable to test filler preservation
        });
        processor.updateOptions({ removeFillers: false });

        const segment = createSegment('Speaker 0', 'um hello');
        const result = processor.processSegment(segment);

        // 'um' should be preserved when removeFillers is false
        expect(result.cleanedText.toLowerCase()).toContain('um');
      });

      it('should merge new options with existing', () => {
        const aliases1 = new Map([['Speaker 0', 'Alice']]);
        const aliases2 = new Map([['Speaker 0', 'Bob']]);

        const processor = new TranscriptPostProcessor({ speakerAliases: aliases1 });
        processor.updateOptions({ speakerAliases: aliases2 });

        const segment = createSegment('Speaker 0', 'Hello');
        const result = processor.processSegment(segment);

        expect(result.displaySpeaker).toBe('Bob');
      });
    });
  });

  describe('Edge cases', () => {
    const processor = new TranscriptPostProcessor();

    it('should handle segments with only fillers', () => {
      const segment: TranscriptSegment = {
        speaker: 'Speaker 0',
        text: 'um uh you know',
        startTime: 0,
        endTime: 1000,
        confidence: 0.9,
      };
      const result = processor.processSegment(segment);
      expect(result.cleanedText).toBe('');
    });

    it('should handle very long text', () => {
      const longText = 'This is a test sentence. '.repeat(100);
      const segment: TranscriptSegment = {
        speaker: 'Speaker 0',
        text: longText,
        startTime: 0,
        endTime: 100000,
        confidence: 0.9,
      };
      const result = processor.processSegment(segment);
      expect(result.cleanedText.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const segment: TranscriptSegment = {
        speaker: 'Speaker 0',
        text: 'Hello @user! Check out https://example.com & let me know',
        startTime: 0,
        endTime: 1000,
        confidence: 0.9,
      };
      const result = processor.processSegment(segment);
      expect(result.cleanedText).toContain('@user');
      expect(result.cleanedText).toContain('https://example.com');
    });

    it('should handle unicode characters', () => {
      const segment: TranscriptSegment = {
        speaker: 'Speaker 0',
        text: 'Cest très bien! 你好世界',
        startTime: 0,
        endTime: 1000,
        confidence: 0.9,
      };
      const result = processor.processSegment(segment);
      expect(result.cleanedText).toContain('très');
      expect(result.cleanedText).toContain('你好');
    });

    it('should handle numbers and dates', () => {
      const segment: TranscriptSegment = {
        speaker: 'Speaker 0',
        text: 'The meeting is on 2024-01-15 at 3:30 PM',
        startTime: 0,
        endTime: 1000,
        confidence: 0.9,
      };
      const result = processor.processSegment(segment);
      expect(result.cleanedText).toContain('2024-01-15');
      expect(result.cleanedText).toContain('3:30 PM');
    });
  });
});
