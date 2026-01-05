/**
 * @ownership
 * @domain Speaker Recognition
 * @description Orchestrates name detection and voice profile matching
 * @single-responsibility YES — speaker recognition pipeline
 */
import { DetectedName, TranscriptSegment } from './nameDetector';
export interface RecognitionResult {
    speakerMap: Map<string, string>;
    detections: DetectedName[];
    newProfiles: string[];
    matchedProfiles: string[];
}
export interface RecognitionOptions {
    organizationId: string;
    meetingId: string;
    calendarParticipants?: string[];
    existingAliases?: Map<string, string>;
}
declare class SpeakerRecognitionService {
    private nameDetector;
    constructor();
    /**
     * Main recognition pipeline
     */
    recognizeSpeakers(segments: TranscriptSegment[], options: RecognitionOptions): Promise<RecognitionResult>;
    /**
     * Re-process a meeting's speaker recognition
     */
    reprocessMeeting(meetingId: string): Promise<RecognitionResult>;
    /**
     * Parse transcript text into segments
     * Assumes format: "Speaker N: text\n\nSpeaker M: text"
     */
    private parseTranscriptSegments;
    /**
     * Update custom name patterns for an organization
     */
    updateOrgPatterns(organizationId: string, patterns: Array<{
        pattern: string;
        nameGroup: number;
        priority: number;
    }>): Promise<void>;
    /**
     * Match from calendar participants
     */
    private matchFromCalendarParticipants;
    /**
     * Find or create a voice profile by name
     */
    private findOrCreateByName;
    /**
     * Record a speaker match for a meeting
     */
    private recordMatch;
}
export declare const speakerRecognitionService: SpeakerRecognitionService;
export type { TranscriptSegment, DetectedName };
//# sourceMappingURL=speakerRecognition.d.ts.map