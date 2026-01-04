/**
 * Timestamp and timing utilities for transcription
 */

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Format milliseconds to timestamp string (HH:MM:SS.mmm)
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Calculate duration between two timestamps
 */
export function calculateDuration(startMs: number, endMs: number): number {
  return Math.max(0, endMs - startMs);
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Merge overlapping time ranges
 */
export function mergeTimeRanges(
  ranges: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (ranges.length === 0) return [];

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;

    if (current.start <= last.end) {
      // Overlapping, merge
      last.end = Math.max(last.end, current.end);
    } else {
      // Not overlapping, add new
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate total speaking time from segments (excluding silence)
 */
export function calculateSpeakingTime(
  segments: Array<{ startMs: number; endMs: number }>
): number {
  const merged = mergeTimeRanges(
    segments.map((s) => ({ start: s.startMs, end: s.endMs }))
  );

  return merged.reduce((total, range) => total + (range.end - range.start), 0);
}

/**
 * Find gaps in audio (silence periods)
 */
export function findSilenceGaps(
  segments: Array<{ startMs: number; endMs: number }>,
  totalDurationMs: number,
  minGapMs = 1000
): Array<{ startMs: number; endMs: number; durationMs: number }> {
  if (segments.length === 0) {
    return [{ startMs: 0, endMs: totalDurationMs, durationMs: totalDurationMs }];
  }

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const gaps: Array<{ startMs: number; endMs: number; durationMs: number }> = [];

  // Check gap at beginning
  if (sorted[0]!.startMs > minGapMs) {
    gaps.push({
      startMs: 0,
      endMs: sorted[0]!.startMs,
      durationMs: sorted[0]!.startMs,
    });
  }

  // Check gaps between segments
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i]!.endMs;
    const gapEnd = sorted[i + 1]!.startMs;
    const gapDuration = gapEnd - gapStart;

    if (gapDuration >= minGapMs) {
      gaps.push({
        startMs: gapStart,
        endMs: gapEnd,
        durationMs: gapDuration,
      });
    }
  }

  // Check gap at end
  const lastEnd = sorted[sorted.length - 1]!.endMs;
  if (totalDurationMs - lastEnd > minGapMs) {
    gaps.push({
      startMs: lastEnd,
      endMs: totalDurationMs,
      durationMs: totalDurationMs - lastEnd,
    });
  }

  return gaps;
}
