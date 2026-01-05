/**
 * @ownership
 * @domain Speaker Name Detection
 * @description Detects speaker names from verbal introductions in transcripts
 * @single-responsibility YES — name detection logic only
 */

export interface DetectedName {
  name: string;
  speakerLabel: string;
  phrase: string;
  timestamp: number;
  confidence: number;
  patternUsed: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Common words that follow names but shouldn't be captured as part of the name
 */
const NAME_TERMINATORS = ['from', 'at', 'with', 'in', 'for', 'and', 'the', 'a', 'to', 'of'];

/**
 * Built-in patterns for detecting speaker introductions
 * Ordered by specificity (most specific first)
 */
const DEFAULT_PATTERNS: Array<{ regex: RegExp; nameGroup: number; confidence: number; id: string }> = [
  // Direct introductions - single name only for greeting patterns
  // Use [A-Za-z]+ to match names regardless of case (they get normalized later)
  {
    id: 'intro_im',
    regex: /\b(?:hi|hey|hello|good\s+(?:morning|afternoon|evening))[,.\s]+(?:everyone[,.\s]+)?(?:i'm|i\s+am)\s+([A-Za-z]+)(?:\s|$|,|\.)/i,
    nameGroup: 1,
    confidence: 0.95,
  },
  // "My name is X" or "My name is X Y" (captures full name without context words)
  {
    id: 'intro_name_is',
    regex: /\b(?:my\s+name\s+is|my\s+name's)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:(?:\s+(?:and|from|at|with))|[,.]|$)/i,
    nameGroup: 1,
    confidence: 0.95,
  },
  {
    id: 'intro_this_is',
    regex: /\bthis\s+is\s+([A-Za-z]+)(?:\s+(?:from|at|with|speaking))/i,
    nameGroup: 1,
    confidence: 0.9,
  },
  {
    id: 'intro_speaking',
    regex: /\b([A-Za-z]+)\s+(?:here|speaking)(?:\s|$|,|\.)/i,
    nameGroup: 1,
    confidence: 0.85,
  },
  // Meeting-specific patterns
  {
    id: 'intro_joining',
    regex: /\b([A-Za-z]+)\s+(?:joining|hopping\s+on|jumping\s+on)(?:\s+(?:from|the|a))?/i,
    nameGroup: 1,
    confidence: 0.8,
  },
  {
    id: 'intro_its',
    regex: /\b(?:it's|its)\s+([A-Za-z]+)(?:\s+(?:here|from|at))?(?:\s|$|,|\.)/i,
    nameGroup: 1,
    confidence: 0.75,
  },
  // Context from others addressing someone
  {
    id: 'thanks_name',
    regex: /\b(?:thanks|thank\s+you)[,\s]+([A-Za-z]+)/i,
    nameGroup: 1,
    confidence: 0.6, // Lower confidence - might be addressing different speaker
  },
];

/**
 * Common words that look like names but aren't
 */
const FALSE_POSITIVE_NAMES = new Set([
  'hi', 'hey', 'hello', 'good', 'morning', 'afternoon', 'evening',
  'everyone', 'guys', 'team', 'folks', 'all',
  'thanks', 'thank', 'okay', 'ok', 'sure', 'yes', 'no',
  'just', 'well', 'now', 'here', 'there',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'zoom', 'teams', 'meet', 'slack', 'google',
]);

/**
 * Validate a detected name
 */
function isValidName(name: string): boolean {
  // First normalize the name (handles all caps)
  const normalizedForCheck = normalizeName(name);
  const lowercased = normalizedForCheck.toLowerCase().trim();

  // Must be at least 2 characters
  if (lowercased.length < 2) return false;

  // Must not be a known false positive
  // Check each word in case of two-part names
  const words = lowercased.split(/\s+/);
  for (const word of words) {
    if (FALSE_POSITIVE_NAMES.has(word)) return false;
  }

  // Must start with a letter
  if (!/^[a-z]/i.test(normalizedForCheck)) return false;

  return true;
}

/**
 * Normalize a detected name
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Main name detector class
 */
export class NameDetector {
  private patterns: Array<{ regex: RegExp; nameGroup: number; confidence: number; id: string }>;

  constructor(customPatterns?: Array<{ pattern: string; nameGroup: number; priority: number }>) {
    // Start with default patterns
    this.patterns = [...DEFAULT_PATTERNS];

    // Add custom patterns if provided
    if (customPatterns) {
      const custom = customPatterns.map((p, idx) => ({
        id: `custom_${idx}`,
        regex: new RegExp(p.pattern, 'i'),
        nameGroup: p.nameGroup,
        confidence: 0.9, // Custom patterns get high confidence
      }));

      // Sort by priority (custom patterns first if high priority)
      this.patterns = [...custom, ...this.patterns];
    }
  }

  /**
   * Detect names from a single transcript segment
   */
  detectInSegment(segment: TranscriptSegment): DetectedName | null {
    const text = segment.text;

    for (const pattern of this.patterns) {
      const match = text.match(pattern.regex);

      if (match && match[pattern.nameGroup]) {
        const rawName = match[pattern.nameGroup];

        if (isValidName(rawName)) {
          return {
            name: normalizeName(rawName),
            speakerLabel: segment.speaker,
            phrase: match[0],
            timestamp: segment.startTime,
            confidence: pattern.confidence,
            patternUsed: pattern.id,
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect names from all segments
   * Returns map of speakerLabel -> detected name info
   */
  detectInTranscript(segments: TranscriptSegment[]): Map<string, DetectedName> {
    const detections = new Map<string, DetectedName>();

    // Focus on early segments (introductions usually happen first)
    // But also check throughout in case of late joiners
    for (const segment of segments) {
      // Skip if we already have a high-confidence detection for this speaker
      const existing = detections.get(segment.speaker);
      if (existing && existing.confidence >= 0.9) {
        continue;
      }

      const detection = this.detectInSegment(segment);

      if (detection) {
        // Keep higher confidence detection
        if (!existing || detection.confidence > existing.confidence) {
          detections.set(segment.speaker, detection);
        }
      }
    }

    return detections;
  }

  /**
   * Get introduction window segments (first N minutes)
   * Introductions are most reliable in the first few minutes
   */
  getIntroductionWindow(segments: TranscriptSegment[], windowMinutes = 5): TranscriptSegment[] {
    const windowEnd = windowMinutes * 60; // Convert to seconds
    return segments.filter(s => s.startTime <= windowEnd);
  }

  /**
   * Detect with higher confidence by focusing on introduction window
   */
  detectWithIntroductionFocus(segments: TranscriptSegment[]): Map<string, DetectedName> {
    // First pass: check introduction window (higher confidence)
    const introSegments = this.getIntroductionWindow(segments, 5);
    const introDetections = this.detectInTranscript(introSegments);

    // Second pass: check rest of transcript for speakers we missed
    const detectedSpeakers = new Set(introDetections.keys());
    const allSpeakers = new Set(segments.map(s => s.speaker));
    const missingSpeakers = [...allSpeakers].filter(s => !detectedSpeakers.has(s));

    if (missingSpeakers.length > 0) {
      const remainingSegments = segments.filter(
        s => missingSpeakers.includes(s.speaker)
      );
      const lateDetections = this.detectInTranscript(remainingSegments);

      // Merge, but with slightly lower confidence for late detections
      for (const [speaker, detection] of lateDetections) {
        introDetections.set(speaker, {
          ...detection,
          confidence: detection.confidence * 0.9, // 10% penalty for late detection
        });
      }
    }

    return introDetections;
  }
}

export const nameDetector = new NameDetector();
