/**
 * Pagination utility functions
 */

import type { PaginationOptions, PaginatedResult, CursorPaginatedResult } from '../types';

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Normalizes pagination options with defaults and limits
 * @param options - Raw pagination options
 * @returns Normalized pagination options
 */
export function normalizePaginationOptions(options: PaginationOptions = {}): Required<Omit<PaginationOptions, 'cursor'>> & { cursor?: string } {
  const page = Math.max(1, options.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));

  return {
    page,
    limit,
    cursor: options.cursor,
  };
}

/**
 * Calculates skip value for offset pagination
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Number of items to skip
 */
export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Creates a paginated result object
 * @param data - Array of items
 * @param total - Total count of items
 * @param options - Pagination options used
 * @returns Paginated result with metadata
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  options: { page: number; limit: number }
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / options.limit);

  return {
    data,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasMore: options.page < totalPages,
    },
  };
}

/**
 * Creates a cursor-paginated result object
 * @param data - Array of items
 * @param getCursor - Function to extract cursor from last item
 * @param limit - Requested limit
 * @param total - Optional total count
 * @returns Cursor-paginated result with metadata
 */
export function createCursorPaginatedResult<T>(
  data: T[],
  getCursor: (item: T) => string,
  limit: number,
  total?: number
): CursorPaginatedResult<T> {
  const hasMore = data.length === limit;
  const lastItem = data[data.length - 1];
  const cursor = lastItem ? getCursor(lastItem) : null;

  return {
    data,
    pagination: {
      cursor,
      hasMore,
      total,
    },
  };
}

/**
 * Parses cursor string into pagination parameters
 * Cursor format: base64 encoded JSON with id and createdAt
 * @param cursor - Cursor string
 * @returns Decoded cursor data or null
 */
export function parseCursor(cursor: string): { id: string; createdAt: Date } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const data = JSON.parse(decoded);

    if (typeof data.id !== 'string' || typeof data.createdAt !== 'string') {
      return null;
    }

    return {
      id: data.id,
      createdAt: new Date(data.createdAt),
    };
  } catch {
    return null;
  }
}

/**
 * Creates a cursor string from item data
 * @param id - Item ID
 * @param createdAt - Item creation date
 * @returns Base64 encoded cursor string
 */
export function createCursor(id: string, createdAt: Date): string {
  const data = { id, createdAt: createdAt.toISOString() };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}
