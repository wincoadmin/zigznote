/**
 * Tests for search utility functions
 */

import {
  escapeSearchQuery,
  toTsQuery,
  extractHighlights,
  highlightTerms,
  rankSearchResults,
  combineSearchScores,
} from '../../src/utils/search';

describe('search utilities', () => {
  describe('escapeSearchQuery', () => {
    it('should escape special characters and join with tsquery AND operator', () => {
      const result = escapeSearchQuery('test & query | with (special) chars!');

      // Special characters from input are removed, words are joined with ' & ' for tsquery
      expect(result).toBe('test & query & with & special & chars');
      // Verify the raw special chars from input don't appear as standalone tokens
      expect(result).not.toContain('|');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
      expect(result).not.toContain('!');
    });

    it('should join words with &', () => {
      const result = escapeSearchQuery('hello world');

      expect(result).toBe('hello & world');
    });

    it('should handle multiple spaces', () => {
      const result = escapeSearchQuery('hello   world  test');

      expect(result).toBe('hello & world & test');
    });

    it('should handle empty string', () => {
      const result = escapeSearchQuery('');

      expect(result).toBe('');
    });
  });

  describe('toTsQuery', () => {
    it('should create plain query by default', () => {
      const result = toTsQuery('hello world');

      expect(result).toBe('hello & world');
    });

    it('should create phrase query', () => {
      const result = toTsQuery('hello world', 'phrase');

      expect(result).toBe('hello <-> world');
    });

    it('should handle single word', () => {
      const result = toTsQuery('hello');

      expect(result).toBe('hello');
    });
  });

  describe('extractHighlights', () => {
    const text = `
      The quick brown fox jumps over the lazy dog.
      This is a test sentence about foxes.
      Another sentence without the search term.
      The fox appears again here.
    `;

    it('should extract sentences containing search terms', () => {
      const highlights = extractHighlights(text, 'fox');

      expect(highlights.length).toBeGreaterThan(0);
      highlights.forEach((h) => {
        expect(h.toLowerCase()).toContain('fox');
      });
    });

    it('should limit number of highlights', () => {
      const highlights = extractHighlights(text, 'the', 100, 2);

      expect(highlights.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for no matches', () => {
      const highlights = extractHighlights(text, 'zebra');

      expect(highlights).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const highlights = extractHighlights(text, '');

      expect(highlights).toEqual([]);
    });

    it('should score by number of term matches', () => {
      const highlights = extractHighlights(text, 'fox');

      // First highlight should have the search term
      expect(highlights[0]?.toLowerCase()).toContain('fox');
    });
  });

  describe('highlightTerms', () => {
    it('should wrap matching terms with markers', () => {
      const result = highlightTerms('The fox is quick', 'fox');

      expect(result).toBe('The **fox** is quick');
    });

    it('should highlight multiple occurrences', () => {
      const result = highlightTerms('fox and fox', 'fox');

      expect(result).toBe('**fox** and **fox**');
    });

    it('should highlight case-insensitively', () => {
      const result = highlightTerms('The FOX is quick', 'fox');

      expect(result).toBe('The **FOX** is quick');
    });

    it('should use custom markers', () => {
      const result = highlightTerms('The fox is quick', 'fox', '<mark>', '</mark>');

      expect(result).toBe('The <mark>fox</mark> is quick');
    });

    it('should highlight multiple terms', () => {
      const result = highlightTerms('The quick brown fox', 'quick fox');

      expect(result).toContain('**quick**');
      expect(result).toContain('**fox**');
    });
  });

  describe('rankSearchResults', () => {
    it('should sort results by score descending', () => {
      const results = [
        { item: { id: '1' }, score: 0.5 },
        { item: { id: '2' }, score: 0.9 },
        { item: { id: '3' }, score: 0.7 },
      ];

      const ranked = rankSearchResults(results);

      expect(ranked[0]?.score).toBe(0.9);
      expect(ranked[1]?.score).toBe(0.7);
      expect(ranked[2]?.score).toBe(0.5);
    });

    it('should not mutate original array', () => {
      const results = [
        { item: { id: '1' }, score: 0.5 },
        { item: { id: '2' }, score: 0.9 },
      ];

      rankSearchResults(results);

      expect(results[0]?.score).toBe(0.5);
    });
  });

  describe('combineSearchScores', () => {
    it('should combine scores with default weights', () => {
      const result = combineSearchScores(0.8, 0.6);

      // Default: 0.3 * keyword + 0.7 * semantic
      expect(result).toBeCloseTo(0.3 * 0.8 + 0.7 * 0.6);
    });

    it('should use custom keyword weight', () => {
      const result = combineSearchScores(0.8, 0.6, 0.5);

      // 0.5 * keyword + 0.5 * semantic
      expect(result).toBeCloseTo(0.5 * 0.8 + 0.5 * 0.6);
    });

    it('should handle zero scores', () => {
      const result = combineSearchScores(0, 0);

      expect(result).toBe(0);
    });

    it('should handle perfect scores', () => {
      const result = combineSearchScores(1, 1);

      expect(result).toBe(1);
    });
  });
});
