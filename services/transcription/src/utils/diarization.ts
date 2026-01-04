/**
 * Speaker diarization utilities
 */

import type { DeepgramWord, DeepgramUtterance, Speaker, TranscriptSegment } from '../types';
import { secondsToMs, calculateDuration } from './timing';

/**
 * Extract unique speakers from Deepgram words
 */
export function extractSpeakersFromWords(words: DeepgramWord[]): Speaker[] {
  const speakerMap = new Map<number, { totalTimeMs: number; wordCount: number }>();

  for (const word of words) {
    if (word.speaker !== undefined) {
      const existing = speakerMap.get(word.speaker) || { totalTimeMs: 0, wordCount: 0 };
      existing.totalTimeMs += secondsToMs(word.end - word.start);
      existing.wordCount += 1;
      speakerMap.set(word.speaker, existing);
    }
  }

  return Array.from(speakerMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, data]) => ({
      id: `speaker_${id}`,
      label: `Speaker ${id + 1}`,
      totalSpeakingTimeMs: data.totalTimeMs,
      wordCount: data.wordCount,
    }));
}

/**
 * Extract unique speakers from Deepgram utterances
 */
export function extractSpeakersFromUtterances(utterances: DeepgramUtterance[]): Speaker[] {
  const speakerMap = new Map<number, { totalTimeMs: number; wordCount: number }>();

  for (const utterance of utterances) {
    const existing = speakerMap.get(utterance.speaker) || { totalTimeMs: 0, wordCount: 0 };
    existing.totalTimeMs += secondsToMs(utterance.end - utterance.start);
    existing.wordCount += utterance.words.length;
    speakerMap.set(utterance.speaker, existing);
  }

  return Array.from(speakerMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, data]) => ({
      id: `speaker_${id}`,
      label: `Speaker ${id + 1}`,
      totalSpeakingTimeMs: data.totalTimeMs,
      wordCount: data.wordCount,
    }));
}

/**
 * Group consecutive words by speaker into segments
 */
export function groupWordsBySpeaker(words: DeepgramWord[]): TranscriptSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptSegment | null = null;
  let currentSpeaker: number | undefined = undefined;

  for (const word of words) {
    const speaker = word.speaker ?? 0;

    if (currentSpeaker !== speaker) {
      // New speaker, start new segment
      if (currentSegment) {
        segments.push(currentSegment);
      }

      currentSpeaker = speaker;
      currentSegment = {
        speaker: `Speaker ${speaker + 1}`,
        text: word.punctuated_word || word.word,
        startMs: secondsToMs(word.start),
        endMs: secondsToMs(word.end),
        confidence: word.confidence,
        words: [{
          word: word.word,
          startMs: secondsToMs(word.start),
          endMs: secondsToMs(word.end),
          confidence: word.confidence,
          speaker,
          punctuatedWord: word.punctuated_word,
        }],
      };
    } else if (currentSegment) {
      // Same speaker, append to segment
      currentSegment.text += ' ' + (word.punctuated_word || word.word);
      currentSegment.endMs = secondsToMs(word.end);
      currentSegment.confidence = (currentSegment.confidence + word.confidence) / 2;
      currentSegment.words?.push({
        word: word.word,
        startMs: secondsToMs(word.start),
        endMs: secondsToMs(word.end),
        confidence: word.confidence,
        speaker,
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
 * Convert Deepgram utterances to transcript segments
 */
export function utterancesToSegments(utterances: DeepgramUtterance[]): TranscriptSegment[] {
  return utterances.map((utterance) => ({
    speaker: `Speaker ${utterance.speaker + 1}`,
    text: utterance.transcript,
    startMs: secondsToMs(utterance.start),
    endMs: secondsToMs(utterance.end),
    confidence: utterance.confidence,
    words: utterance.words.map((w) => ({
      word: w.word,
      startMs: secondsToMs(w.start),
      endMs: secondsToMs(w.end),
      confidence: w.confidence,
      speaker: w.speaker,
      punctuatedWord: w.punctuated_word,
    })),
  }));
}

/**
 * Merge adjacent segments from the same speaker if gap is small
 */
export function mergeAdjacentSegments(
  segments: TranscriptSegment[],
  maxGapMs = 1500
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0]!, words: [...(segments[0]!.words || [])] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]!;
    const gap = next.startMs - current.endMs;

    if (current.speaker === next.speaker && gap <= maxGapMs) {
      // Merge segments
      current.text += ' ' + next.text;
      current.endMs = next.endMs;
      current.confidence = (current.confidence + next.confidence) / 2;
      if (next.words) {
        current.words = [...(current.words || []), ...next.words];
      }
    } else {
      // Push current and start new
      merged.push(current);
      current = { ...next, words: [...(next.words || [])] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Calculate speaking statistics per speaker
 */
export function calculateSpeakerStats(segments: TranscriptSegment[]): Map<string, {
  totalTimeMs: number;
  wordCount: number;
  segmentCount: number;
  averageSegmentLengthMs: number;
}> {
  const stats = new Map<string, {
    totalTimeMs: number;
    wordCount: number;
    segmentCount: number;
    averageSegmentLengthMs: number;
  }>();

  for (const segment of segments) {
    const existing = stats.get(segment.speaker) || {
      totalTimeMs: 0,
      wordCount: 0,
      segmentCount: 0,
      averageSegmentLengthMs: 0,
    };

    const segmentDuration = calculateDuration(segment.startMs, segment.endMs);
    existing.totalTimeMs += segmentDuration;
    existing.wordCount += segment.words?.length || segment.text.split(/\s+/).length;
    existing.segmentCount += 1;

    stats.set(segment.speaker, existing);
  }

  // Calculate averages
  for (const [speaker, data] of stats) {
    data.averageSegmentLengthMs = data.segmentCount > 0
      ? Math.round(data.totalTimeMs / data.segmentCount)
      : 0;
    stats.set(speaker, data);
  }

  return stats;
}

/**
 * Identify the dominant speaker (most speaking time)
 */
export function getDominantSpeaker(speakers: Speaker[]): Speaker | undefined {
  if (speakers.length === 0) return undefined;

  return speakers.reduce((dominant, current) =>
    current.totalSpeakingTimeMs > dominant.totalSpeakingTimeMs ? current : dominant
  );
}

/**
 * Calculate talk ratio between speakers
 */
export function calculateTalkRatio(speakers: Speaker[]): Map<string, number> {
  const totalTime = speakers.reduce((sum, s) => sum + s.totalSpeakingTimeMs, 0);
  const ratios = new Map<string, number>();

  for (const speaker of speakers) {
    ratios.set(speaker.label, totalTime > 0 ? speaker.totalSpeakingTimeMs / totalTime : 0);
  }

  return ratios;
}
