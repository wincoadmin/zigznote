/**
 * Tests for pagination utility functions
 */

import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
  createCursorPaginatedResult,
  parseCursor,
  createCursor,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../src/utils/pagination';

describe('pagination utilities', () => {
  describe('normalizePaginationOptions', () => {
    it('should return defaults when no options provided', () => {
      const result = normalizePaginationOptions();

      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
    });

    it('should use provided page and limit', () => {
      const result = normalizePaginationOptions({ page: 5, limit: 50 });

      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('should enforce minimum page of 1', () => {
      const result = normalizePaginationOptions({ page: 0 });

      expect(result.page).toBe(1);
    });

    it('should enforce minimum page of 1 for negative values', () => {
      const result = normalizePaginationOptions({ page: -5 });

      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit', () => {
      const result = normalizePaginationOptions({ limit: 500 });

      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('should enforce minimum limit of 1', () => {
      const result = normalizePaginationOptions({ limit: 0 });

      expect(result.limit).toBe(1);
    });

    it('should pass through cursor', () => {
      const result = normalizePaginationOptions({ cursor: 'abc123' });

      expect(result.cursor).toBe('abc123');
    });
  });

  describe('calculateSkip', () => {
    it('should return 0 for first page', () => {
      expect(calculateSkip(1, 20)).toBe(0);
    });

    it('should calculate skip correctly for page 2', () => {
      expect(calculateSkip(2, 20)).toBe(20);
    });

    it('should calculate skip correctly for page 5', () => {
      expect(calculateSkip(5, 10)).toBe(40);
    });
  });

  describe('createPaginatedResult', () => {
    it('should create paginated result with correct metadata', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = createPaginatedResult(data, 100, { page: 1, limit: 20 });

      expect(result.data).toBe(data);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should indicate no more pages on last page', () => {
      const data = [{ id: '1' }];
      const result = createPaginatedResult(data, 5, { page: 5, limit: 1 });

      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const result = createPaginatedResult([], 0, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('createCursorPaginatedResult', () => {
    it('should create cursor paginated result', () => {
      const data = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
      ];
      const result = createCursorPaginatedResult(
        data,
        (item) => item.id,
        10
      );

      expect(result.data).toBe(data);
      expect(result.pagination.cursor).toBe('2');
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should indicate more when data length equals limit', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
      const result = createCursorPaginatedResult(
        data,
        (item) => item.id,
        10
      );

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle empty results', () => {
      const result = createCursorPaginatedResult(
        [],
        (item: { id: string }) => item.id,
        10
      );

      expect(result.pagination.cursor).toBeNull();
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('parseCursor and createCursor', () => {
    it('should create and parse cursor correctly', () => {
      const id = 'test-id-123';
      const createdAt = new Date('2024-01-15T10:00:00Z');

      const cursor = createCursor(id, createdAt);
      const parsed = parseCursor(cursor);

      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe(id);
      expect(parsed?.createdAt.toISOString()).toBe(createdAt.toISOString());
    });

    it('should return null for invalid cursor', () => {
      expect(parseCursor('invalid')).toBeNull();
    });

    it('should return null for cursor with missing fields', () => {
      const incomplete = Buffer.from(JSON.stringify({ id: 'test' })).toString(
        'base64'
      );
      expect(parseCursor(incomplete)).toBeNull();
    });
  });
});
