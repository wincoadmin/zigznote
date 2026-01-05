/**
 * @ownership
 * @domain Transcript Post-Processing
 * @description Transforms raw transcripts into polished, readable text
 * @single-responsibility YES — all transcript cleanup operations
 */

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface ProcessedSegment extends TranscriptSegment {
  cleanedText: string;
  displaySpeaker: string;
  lowConfidenceRanges: Array<{ start: number; end: number }>;
}

export interface PostProcessorOptions {
  removeFillers?: boolean;
  cleanSentenceBoundaries?: boolean;
  highlightLowConfidence?: boolean;
  confidenceThreshold?: number;
  speakerAliases?: Map<string, string>;
}

const DEFAULT_OPTIONS: Required<PostProcessorOptions> = {
  removeFillers: true,
  cleanSentenceBoundaries: true,
  highlightLowConfidence: true,
  confidenceThreshold: 0.7,
  speakerAliases: new Map(),
};

/**
 * Filler words and phrases to remove
 * Organized by category for maintainability
 */
const FILLER_PATTERNS = {
  // Single word fillers
  singleWord: /\b(um|uh|eh|ah|er|mm|hmm|mhm|erm)\b/gi,

  // Common verbal tics
  verbalTics:
    /\b(like|basically|actually|literally|honestly|obviously|clearly|definitely|absolutely|totally|really|very|just|so|well|now|okay|ok|right|yeah|yep|yup|nope|anyway|anyways)\b(?=\s*,?\s*(?:like|basically|actually|literally|honestly|obviously|I|you|we|they|it|the|a|an|this|that))/gi,

  // Phrase fillers
  phrases:
    /\b(you know|I mean|kind of|sort of|type of|in a sense|at the end of the day|to be honest|to be fair|if you will|as it were|if that makes sense|does that make sense)\b/gi,

  // Repeated words (stammering)
  repetition: /\b(\w+)\s+\1\b/gi,

  // False starts (incomplete thoughts followed by restart)
  falseStarts: /\b(I|we|they|it|the|so|but|and)\s*[-–—]\s*/gi,
};

/**
 * Clean up extra whitespace and punctuation
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\s+([.,!?])/g, '$1') // Remove space before punctuation
    .replace(/([.,!?])\s*([.,!?])/g, '$1') // Remove duplicate punctuation
    .replace(/^\s+|\s+$/g, '') // Trim
    .replace(/\s*,\s*,/g, ',') // Remove double commas
    .replace(/,\s*\./g, '.') // Comma before period
    .trim();
}

/**
 * Remove filler words from text
 */
export function removeFillers(text: string): string {
  let cleaned = text;

  // Apply each filler pattern
  for (const pattern of Object.values(FILLER_PATTERNS)) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  return normalizeWhitespace(cleaned);
}

/**
 * Fix sentence boundaries
 * - Capitalize after periods
 * - Add periods to sentences that end without punctuation
 * - Fix spacing around punctuation
 */
export function cleanSentenceBoundaries(text: string): string {
  let cleaned = text;

  // Capitalize first letter after sentence-ending punctuation
  cleaned = cleaned.replace(/([.!?])\s+([a-z])/g, (_, punct, letter) =>
    `${punct} ${letter.toUpperCase()}`
  );

  // Capitalize first letter of text
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add period at end if missing punctuation
  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

/**
 * Identify low confidence regions for highlighting
 */
export function findLowConfidenceRanges(
  words: Array<{ word: string; confidence: number }>,
  threshold: number
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let currentRange: { start: number; end: number } | null = null;
  let charPosition = 0;

  for (const wordObj of words) {
    const wordStart = charPosition;
    const wordEnd = charPosition + wordObj.word.length;

    if (wordObj.confidence < threshold) {
      if (currentRange && currentRange.end === wordStart - 1) {
        // Extend current range
        currentRange.end = wordEnd;
      } else {
        // Start new range
        if (currentRange) ranges.push(currentRange);
        currentRange = { start: wordStart, end: wordEnd };
      }
    } else {
      if (currentRange) {
        ranges.push(currentRange);
        currentRange = null;
      }
    }

    charPosition = wordEnd + 1; // +1 for space
  }

  if (currentRange) ranges.push(currentRange);
  return ranges;
}

/**
 * Apply speaker aliases to get display names
 */
export function resolveSpeaker(
  speakerLabel: string,
  aliases: Map<string, string>
): string {
  return aliases.get(speakerLabel) || speakerLabel;
}

/**
 * Main post-processor class
 */
export class TranscriptPostProcessor {
  private options: Required<PostProcessorOptions>;

  constructor(options: PostProcessorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a single segment
   */
  processSegment(segment: TranscriptSegment): ProcessedSegment {
    let cleanedText = segment.text;

    // Remove fillers
    if (this.options.removeFillers) {
      cleanedText = removeFillers(cleanedText);
    }

    // Clean sentence boundaries
    if (this.options.cleanSentenceBoundaries) {
      cleanedText = cleanSentenceBoundaries(cleanedText);
    }

    // Find low confidence ranges
    const lowConfidenceRanges =
      this.options.highlightLowConfidence && segment.words
        ? findLowConfidenceRanges(segment.words, this.options.confidenceThreshold)
        : [];

    // Resolve speaker name
    const displaySpeaker = resolveSpeaker(
      segment.speaker,
      this.options.speakerAliases
    );

    return {
      ...segment,
      cleanedText,
      displaySpeaker,
      lowConfidenceRanges,
    };
  }

  /**
   * Process entire transcript
   */
  processTranscript(segments: TranscriptSegment[]): ProcessedSegment[] {
    return segments.map((segment) => this.processSegment(segment));
  }

  /**
   * Get full cleaned text from processed segments
   */
  getFullText(processedSegments: ProcessedSegment[]): string {
    return processedSegments
      .map((s) => `${s.displaySpeaker}: ${s.cleanedText}`)
      .join('\n\n');
  }

  /**
   * Update options (e.g., after loading speaker aliases)
   */
  updateOptions(options: Partial<PostProcessorOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export const transcriptPostProcessor = new TranscriptPostProcessor();
