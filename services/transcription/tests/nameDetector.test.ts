import { NameDetector } from '../src/nameDetector';

describe('NameDetector', () => {
  const detector = new NameDetector();

  describe('detectInSegment', () => {
    it('should detect "Hi, I\'m [Name]" pattern', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi everyone, I'm Sarah. Thanks for joining.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Sarah');
      expect(result?.speakerLabel).toBe('Speaker 0');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });

    it('should detect "My name is [Name]" pattern', () => {
      const segment = {
        speaker: 'Speaker 1',
        text: "My name is John Smith and I'll be leading this meeting.",
        startTime: 10,
        endTime: 15,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Smith');
    });

    it('should detect "[Name] here" pattern', () => {
      const segment = {
        speaker: 'Speaker 2',
        text: 'Michael here, sorry I was on mute.',
        startTime: 20,
        endTime: 25,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Michael');
    });

    it('should detect "This is [Name] from" pattern', () => {
      const segment = {
        speaker: 'Speaker 3',
        text: 'This is Jennifer from the marketing team.',
        startTime: 30,
        endTime: 35,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Jennifer');
    });

    it('should detect "[Name] speaking" pattern', () => {
      const segment = {
        speaker: 'Speaker 4',
        text: 'David speaking, can everyone hear me?',
        startTime: 40,
        endTime: 45,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('David');
    });

    it('should detect "Hello, I am [Name]" pattern', () => {
      const segment = {
        speaker: 'Speaker 5',
        text: 'Hello everyone, I am Robert. Nice to meet you all.',
        startTime: 50,
        endTime: 55,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Robert');
    });

    it('should detect "It\'s [Name] here" pattern', () => {
      const segment = {
        speaker: 'Speaker 6',
        text: "It's Amanda here, just joined.",
        startTime: 60,
        endTime: 65,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Amanda');
    });

    it('should detect "[Name] joining" pattern', () => {
      const segment = {
        speaker: 'Speaker 7',
        text: 'Chris joining from the New York office.',
        startTime: 70,
        endTime: 75,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Chris');
    });

    it('should return null for segments without introductions', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: 'I think we should focus on the Q4 targets.',
        startTime: 100,
        endTime: 105,
      };

      const result = detector.detectInSegment(segment);

      expect(result).toBeNull();
    });

    it('should reject false positive day names', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi everyone, I'm here to discuss the Monday deadline.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      // Should not detect "Monday" as a name
      expect(result?.name).not.toBe('Monday');
    });

    it('should reject false positive month names', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi everyone, I'm here for the June review.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result?.name).not.toBe('June');
    });

    it('should reject false positive common words', () => {
      const segments = [
        { speaker: 'Speaker 0', text: "Thanks everyone for joining.", startTime: 0, endTime: 5 },
        { speaker: 'Speaker 1', text: "Hello team, let's get started.", startTime: 5, endTime: 10 },
        { speaker: 'Speaker 2', text: "Good morning folks.", startTime: 10, endTime: 15 },
      ];

      for (const segment of segments) {
        const result = detector.detectInSegment(segment);
        // None of these should detect names like "Everyone", "Team", "Folks"
        if (result) {
          expect(['Everyone', 'Team', 'Folks', 'Hello', 'Good', 'Morning']).not.toContain(result.name);
        }
      }
    });

    it('should normalize detected names to proper case', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi, I'm SARAH.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result?.name).toBe('Sarah');
    });

    it('should handle two-part names', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "My name is John Smith, and I'll be presenting today.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result?.name).toBe('John Smith');
    });
  });

  describe('detectInTranscript', () => {
    it('should detect multiple speakers', () => {
      const segments = [
        { speaker: 'Speaker 0', text: "Hi, I'm Alice.", startTime: 0, endTime: 2 },
        { speaker: 'Speaker 1', text: "Hello, my name is Bob.", startTime: 3, endTime: 5 },
        { speaker: 'Speaker 0', text: "Thanks for joining, Bob.", startTime: 6, endTime: 8 },
      ];

      const results = detector.detectInTranscript(segments);

      expect(results.size).toBe(2);
      expect(results.get('Speaker 0')?.name).toBe('Alice');
      expect(results.get('Speaker 1')?.name).toBe('Bob');
    });

    it('should prefer higher confidence detections', () => {
      const segments = [
        // Lower confidence detection first (someone addressing thanks pattern - attributed to Speaker 0)
        { speaker: 'Speaker 0', text: "Thanks Sarah for that.", startTime: 0, endTime: 2 },
        // Higher confidence detection later (self-introduction for same speaker)
        { speaker: 'Speaker 0', text: "Hi, I'm Mike.", startTime: 10, endTime: 12 },
      ];

      const results = detector.detectInTranscript(segments);

      // The thanks pattern matches "Sarah" for Speaker 0 (who said thanks)
      // Then the self-introduction matches "Mike" for Speaker 0 with higher confidence
      // Since intro_im (0.95) > thanks_name (0.6), Mike should win
      expect(results.get('Speaker 0')?.name).toBe('Mike');
    });

    it('should skip speakers that already have high-confidence detection', () => {
      const segments = [
        // High confidence detection
        { speaker: 'Speaker 0', text: "Hi, I'm Sarah.", startTime: 0, endTime: 2 },
        // Another detection attempt should be skipped
        { speaker: 'Speaker 0', text: "This is Sarah speaking.", startTime: 10, endTime: 12 },
      ];

      const results = detector.detectInTranscript(segments);

      expect(results.size).toBe(1);
      expect(results.get('Speaker 0')?.name).toBe('Sarah');
      expect(results.get('Speaker 0')?.patternUsed).toBe('intro_im');
    });
  });

  describe('getIntroductionWindow', () => {
    it('should return segments within the time window', () => {
      const segments = [
        { speaker: 'Speaker 0', text: "First", startTime: 0, endTime: 10 },
        { speaker: 'Speaker 1', text: "Second", startTime: 100, endTime: 110 },
        { speaker: 'Speaker 2', text: "Third", startTime: 300, endTime: 310 }, // At 5 min mark
        { speaker: 'Speaker 3', text: "Fourth", startTime: 400, endTime: 410 }, // After 5 min
      ];

      const result = detector.getIntroductionWindow(segments, 5);

      expect(result.length).toBe(3);
      expect(result.map(s => s.speaker)).toEqual(['Speaker 0', 'Speaker 1', 'Speaker 2']);
    });

    it('should return empty array for empty segments', () => {
      const result = detector.getIntroductionWindow([], 5);
      expect(result).toEqual([]);
    });
  });

  describe('detectWithIntroductionFocus', () => {
    it('should prioritize introduction window', () => {
      const segments = [
        // In intro window (first 5 minutes)
        { speaker: 'Speaker 0', text: "Hi, I'm Sarah.", startTime: 30, endTime: 32 },
        // Late detection (after 5 minutes)
        { speaker: 'Speaker 1', text: "John speaking.", startTime: 400, endTime: 402 },
      ];

      const results = detector.detectWithIntroductionFocus(segments);

      // Early detection should have higher confidence
      expect(results.get('Speaker 0')?.confidence).toBeGreaterThan(
        results.get('Speaker 1')?.confidence || 0
      );
    });

    it('should find late joiners outside introduction window', () => {
      const segments = [
        // In intro window
        { speaker: 'Speaker 0', text: "Hi, I'm Sarah.", startTime: 30, endTime: 32 },
        // Late joiner (after 5 minutes)
        { speaker: 'Speaker 1', text: "Hi, I'm John, sorry I'm late.", startTime: 600, endTime: 605 },
      ];

      const results = detector.detectWithIntroductionFocus(segments);

      expect(results.size).toBe(2);
      expect(results.get('Speaker 0')?.name).toBe('Sarah');
      expect(results.get('Speaker 1')?.name).toBe('John');
      // Late detection should have reduced confidence
      expect(results.get('Speaker 1')?.confidence).toBeLessThan(
        results.get('Speaker 0')?.confidence || 1
      );
    });

    it('should not duplicate detections for speakers found in intro window', () => {
      const segments = [
        // In intro window
        { speaker: 'Speaker 0', text: "Hi, I'm Sarah.", startTime: 30, endTime: 32 },
        // Same speaker introduces again later
        { speaker: 'Speaker 0', text: "This is Sarah again.", startTime: 600, endTime: 605 },
      ];

      const results = detector.detectWithIntroductionFocus(segments);

      expect(results.size).toBe(1);
      expect(results.get('Speaker 0')?.name).toBe('Sarah');
      // Should keep the intro window detection (higher confidence)
      expect(results.get('Speaker 0')?.timestamp).toBe(30);
    });
  });

  describe('custom patterns', () => {
    it('should use custom patterns when provided', () => {
      const customDetector = new NameDetector([
        {
          pattern: '\\[([A-Z][a-z]+)\\]:', // Match "[Name]:"
          nameGroup: 1,
          priority: 10,
        },
      ]);

      const segment = {
        speaker: 'Speaker 0',
        text: '[Alex]: Hello everyone.',
        startTime: 0,
        endTime: 5,
      };

      const result = customDetector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Alex');
      expect(result?.patternUsed).toBe('custom_0');
    });

    it('should prioritize custom patterns over default patterns', () => {
      const customDetector = new NameDetector([
        {
          pattern: 'Agent ([A-Z][a-z]+) reporting',
          nameGroup: 1,
          priority: 10,
        },
      ]);

      const segment = {
        speaker: 'Speaker 0',
        text: "Hi, I'm Sarah. Agent Bond reporting for duty.",
        startTime: 0,
        endTime: 5,
      };

      const result = customDetector.detectInSegment(segment);

      // Should find the custom pattern first
      expect(result?.name).toBe('Bond');
      expect(result?.patternUsed).toBe('custom_0');
    });
  });
});
