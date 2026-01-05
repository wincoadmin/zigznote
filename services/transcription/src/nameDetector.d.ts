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
 * Main name detector class
 */
export declare class NameDetector {
    private patterns;
    constructor(customPatterns?: Array<{
        pattern: string;
        nameGroup: number;
        priority: number;
    }>);
    /**
     * Detect names from a single transcript segment
     */
    detectInSegment(segment: TranscriptSegment): DetectedName | null;
    /**
     * Detect names from all segments
     * Returns map of speakerLabel -> detected name info
     */
    detectInTranscript(segments: TranscriptSegment[]): Map<string, DetectedName>;
    /**
     * Get introduction window segments (first N minutes)
     * Introductions are most reliable in the first few minutes
     */
    getIntroductionWindow(segments: TranscriptSegment[], windowMinutes?: number): TranscriptSegment[];
    /**
     * Detect with higher confidence by focusing on introduction window
     */
    detectWithIntroductionFocus(segments: TranscriptSegment[]): Map<string, DetectedName>;
}
export declare const nameDetector: NameDetector;
//# sourceMappingURL=nameDetector.d.ts.map