/**
 * Full-text search utility functions for PostgreSQL
 */

import { Prisma } from '@prisma/client';
import type { SearchResult } from '../types';

/**
 * Escapes special characters in search query for PostgreSQL ts_query
 * @param query - Raw search query
 * @returns Escaped query safe for ts_query
 */
export function escapeSearchQuery(query: string): string {
  // Remove special characters that have meaning in tsquery
  return query
    .replace(/[&|!():*]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .join(' & ');
}

/**
 * Converts a search query to PostgreSQL tsquery format
 * @param query - Raw search query
 * @param mode - Search mode: 'plain' (default), 'phrase', 'websearch'
 * @returns tsquery-formatted string
 */
export function toTsQuery(
  query: string,
  mode: 'plain' | 'phrase' | 'websearch' = 'plain'
): string {
  const escaped = escapeSearchQuery(query);

  switch (mode) {
    case 'phrase':
      // Phrase search: all words must appear in order
      return escaped.split(' & ').join(' <-> ');
    case 'websearch':
      // Websearch mode: supports quoted phrases and operators
      return escaped;
    default:
      // Plain mode: AND all terms
      return escaped;
  }
}

/**
 * Builds a raw SQL where clause for full-text search on transcripts
 * @param query - Search query
 * @param column - Column name containing tsvector (default: 'text_search')
 * @returns Prisma raw SQL for where clause
 */
export function buildFullTextSearchWhere(
  query: string,
  column = 'text_search'
): Prisma.Sql {
  const tsQuery = toTsQuery(query);
  return Prisma.sql`${Prisma.raw(column)} @@ to_tsquery('english', ${tsQuery})`;
}

/**
 * Builds a raw SQL order clause for full-text search ranking
 * @param query - Search query
 * @param column - Column name containing tsvector (default: 'text_search')
 * @returns Prisma raw SQL for order clause
 */
export function buildFullTextSearchRank(
  query: string,
  column = 'text_search'
): Prisma.Sql {
  const tsQuery = toTsQuery(query);
  return Prisma.sql`ts_rank(${Prisma.raw(column)}, to_tsquery('english', ${tsQuery})) DESC`;
}

/**
 * Extracts highlighted snippets from text matching the query
 * @param text - Full text to search in
 * @param query - Search query
 * @param maxLength - Maximum length of each snippet
 * @param maxSnippets - Maximum number of snippets to return
 * @returns Array of highlighted snippets
 */
export function extractHighlights(
  text: string,
  query: string,
  maxLength = 150,
  maxSnippets = 3
): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const highlights: Array<{ sentence: string; score: number }> = [];

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (lowerSentence.includes(term)) {
        score += 1;
      }
    }

    if (score > 0) {
      highlights.push({
        sentence: sentence.trim().substring(0, maxLength),
        score,
      });
    }
  }

  // Sort by score and take top snippets
  return highlights
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSnippets)
    .map((h) => h.sentence);
}

/**
 * Highlights matching terms in text with markers
 * @param text - Text to highlight
 * @param query - Search query
 * @param startMarker - Marker before matched term
 * @param endMarker - Marker after matched term
 * @returns Text with highlighted terms
 */
export function highlightTerms(
  text: string,
  query: string,
  startMarker = '**',
  endMarker = '**'
): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;

  let result = text;

  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    result = result.replace(regex, `${startMarker}$1${endMarker}`);
  }

  return result;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ranks search results by relevance
 * @param results - Array of search results with scores
 * @returns Sorted array by relevance score (highest first)
 */
export function rankSearchResults<T>(
  results: SearchResult<T>[]
): SearchResult<T>[] {
  return [...results].sort((a, b) => b.score - a.score);
}

/**
 * Combines keyword and semantic search scores
 * @param keywordScore - Score from keyword/full-text search (0-1)
 * @param semanticScore - Score from semantic/vector search (0-1)
 * @param keywordWeight - Weight for keyword score (default 0.3)
 * @returns Combined score
 */
export function combineSearchScores(
  keywordScore: number,
  semanticScore: number,
  keywordWeight = 0.3
): number {
  const semanticWeight = 1 - keywordWeight;
  return keywordScore * keywordWeight + semanticScore * semanticWeight;
}
