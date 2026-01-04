/**
 * Transcript segment formatting utilities
 */

import type { TranscriptSegment, DeepgramAlternative, Word } from '../types';
import { secondsToMs, formatTimestamp } from './timing';

/**
 * Convert Deepgram alternative to segments (without diarization)
 */
export function alternativeToSegments(
  alternative: DeepgramAlternative,
  segmentDurationMs = 30000
): TranscriptSegment[] {
  const words = alternative.words;
  if (words.length === 0) return [];

  // If no paragraphs, segment by time chunks
  if (!alternative.paragraphs?.paragraphs?.length) {
    return segmentByDuration(alternative, segmentDurationMs);
  }

  // Use Deepgram's paragraphs
  return alternative.paragraphs.paragraphs.flatMap((paragraph) =>
    paragraph.sentences.map((sentence) => ({
      speaker: paragraph.speaker !== undefined ? `Speaker ${paragraph.speaker + 1}` : 'Speaker 1',
      text: sentence.text,
      startMs: secondsToMs(sentence.start),
      endMs: secondsToMs(sentence.end),
      confidence: calculateSegmentConfidence(words, sentence.start, sentence.end),
      words: filterWordsByTimeRange(words, sentence.start, sentence.end),
    }))
  );
}

/**
 * Segment transcript by fixed duration chunks
 */
function segmentByDuration(
  alternative: DeepgramAlternative,
  durationMs: number
): TranscriptSegment[] {
  const words = alternative.words;
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptSegment | null = null;
  let segmentStartTime = 0;

  for (const word of words) {
    const wordStartMs = secondsToMs(word.start);

    if (!currentSegment || wordStartMs - segmentStartTime >= durationMs) {
      // Start new segment
      if (currentSegment) {
        segments.push(currentSegment);
      }

      segmentStartTime = wordStartMs;
      currentSegment = {
        speaker: word.speaker !== undefined ? `Speaker ${word.speaker + 1}` : 'Speaker 1',
        text: word.punctuated_word || word.word,
        startMs: wordStartMs,
        endMs: secondsToMs(word.end),
        confidence: word.confidence,
        words: [{
          word: word.word,
          startMs: wordStartMs,
          endMs: secondsToMs(word.end),
          confidence: word.confidence,
          speaker: word.speaker,
          punctuatedWord: word.punctuated_word,
        }],
      };
    } else {
      // Append to current segment
      currentSegment.text += ' ' + (word.punctuated_word || word.word);
      currentSegment.endMs = secondsToMs(word.end);
      currentSegment.confidence = (currentSegment.confidence + word.confidence) / 2;
      currentSegment.words?.push({
        word: word.word,
        startMs: secondsToMs(word.start),
        endMs: secondsToMs(word.end),
        confidence: word.confidence,
        speaker: word.speaker,
        punctuatedWord: word.punctuated_word,
      });
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Filter words by time range
 */
function filterWordsByTimeRange(
  words: DeepgramAlternative['words'],
  startSec: number,
  endSec: number
): Word[] {
  return words
    .filter((w) => w.start >= startSec && w.end <= endSec)
    .map((w) => ({
      word: w.word,
      startMs: secondsToMs(w.start),
      endMs: secondsToMs(w.end),
      confidence: w.confidence,
      speaker: w.speaker,
      punctuatedWord: w.punctuated_word,
    }));
}

/**
 * Calculate average confidence for words in a time range
 */
function calculateSegmentConfidence(
  words: DeepgramAlternative['words'],
  startSec: number,
  endSec: number
): number {
  const segmentWords = words.filter((w) => w.start >= startSec && w.end <= endSec);
  if (segmentWords.length === 0) return 0;

  const totalConfidence = segmentWords.reduce((sum, w) => sum + w.confidence, 0);
  return totalConfidence / segmentWords.length;
}

/**
 * Format segments for display with timestamps
 */
export function formatSegmentsForDisplay(segments: TranscriptSegment[]): string[] {
  return segments.map((segment) => {
    const timestamp = formatTimestamp(segment.startMs);
    return `[${timestamp}] ${segment.speaker}: ${segment.text}`;
  });
}

/**
 * Get full text from segments
 */
export function getFullTextFromSegments(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(' ');
}

/**
 * Get total word count from segments
 */
export function getWordCountFromSegments(segments: TranscriptSegment[]): number {
  return segments.reduce((total, segment) => {
    if (segment.words) {
      return total + segment.words.length;
    }
    return total + segment.text.split(/\s+/).filter((w) => w.length > 0).length;
  }, 0);
}

/**
 * Calculate average confidence from segments
 */
export function getAverageConfidence(segments: TranscriptSegment[]): number {
  if (segments.length === 0) return 0;

  const totalConfidence = segments.reduce((sum, s) => sum + s.confidence, 0);
  return totalConfidence / segments.length;
}

/**
 * Find segments containing a search term
 */
export function searchSegments(
  segments: TranscriptSegment[],
  searchTerm: string,
  caseSensitive = false
): TranscriptSegment[] {
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return segments.filter((segment) => {
    const text = caseSensitive ? segment.text : segment.text.toLowerCase();
    return text.includes(term);
  });
}

/**
 * Get segment at a specific time
 */
export function getSegmentAtTime(
  segments: TranscriptSegment[],
  timeMs: number
): TranscriptSegment | undefined {
  return segments.find(
    (segment) => segment.startMs <= timeMs && segment.endMs >= timeMs
  );
}

/**
 * Split long segment into smaller chunks
 */
export function splitLongSegment(
  segment: TranscriptSegment,
  maxWords = 50
): TranscriptSegment[] {
  const words = segment.words || segment.text.split(/\s+/);

  if (words.length <= maxWords) {
    return [segment];
  }

  const chunks: TranscriptSegment[] = [];
  const wordArray = segment.words || [];

  for (let i = 0; i < wordArray.length; i += maxWords) {
    const chunkWords = wordArray.slice(i, i + maxWords);
    if (chunkWords.length === 0) continue;

    chunks.push({
      speaker: segment.speaker,
      text: chunkWords.map((w) => w.punctuatedWord || w.word).join(' '),
      startMs: chunkWords[0]!.startMs,
      endMs: chunkWords[chunkWords.length - 1]!.endMs,
      confidence: chunkWords.reduce((sum, w) => sum + w.confidence, 0) / chunkWords.length,
      words: chunkWords,
    });
  }

  return chunks;
}

/**
 * Validate segment data integrity
 */
export function validateSegment(segment: TranscriptSegment): string[] {
  const errors: string[] = [];

  if (!segment.speaker) {
    errors.push('Missing speaker');
  }

  if (!segment.text || segment.text.trim().length === 0) {
    errors.push('Empty text');
  }

  if (segment.startMs < 0) {
    errors.push('Invalid start time (negative)');
  }

  if (segment.endMs < segment.startMs) {
    errors.push('End time before start time');
  }

  if (segment.confidence < 0 || segment.confidence > 1) {
    errors.push('Invalid confidence (should be 0-1)');
  }

  return errors;
}
