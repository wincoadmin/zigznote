/**
 * @ownership
 * @domain Speaker Recognition
 * @description Orchestrates name detection and voice profile matching
 * @single-responsibility YES — speaker recognition pipeline
 */

import { NameDetector, DetectedName, TranscriptSegment } from './nameDetector';
import { prisma } from '@zigznote/database';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'speaker-recognition',
});

export interface RecognitionResult {
  speakerMap: Map<string, string>; // speakerLabel -> displayName
  detections: DetectedName[];
  newProfiles: string[]; // IDs of newly created profiles
  matchedProfiles: string[]; // IDs of matched existing profiles
}

export interface RecognitionOptions {
  organizationId: string;
  meetingId: string;
  calendarParticipants?: string[]; // Email addresses from calendar event
  existingAliases?: Map<string, string>; // Manual aliases from Phase 6.6
}

class SpeakerRecognitionService {
  private nameDetector: NameDetector;

  constructor() {
    this.nameDetector = new NameDetector();
  }

  /**
   * Main recognition pipeline
   */
  async recognizeSpeakers(
    segments: TranscriptSegment[],
    options: RecognitionOptions
  ): Promise<RecognitionResult> {
    const { organizationId, meetingId, calendarParticipants, existingAliases } = options;

    const speakerMap = new Map<string, string>();
    const newProfiles: string[] = [];
    const matchedProfiles: string[] = [];

    // Get all unique speakers
    const speakers = [...new Set(segments.map(s => s.speaker))];

    // Step 1: Apply existing manual aliases first (highest priority)
    if (existingAliases) {
      for (const [label, name] of existingAliases) {
        speakerMap.set(label, name);
      }
    }

    // Step 2: Try to match from calendar participants
    if (calendarParticipants && calendarParticipants.length > 0) {
      const emailProfiles = await this.matchFromCalendarParticipants(
        organizationId,
        calendarParticipants
      );

      // We know WHO should be in the meeting, but not which speaker label they are
      // This will be resolved by name detection or voice matching
      logger.info({
        meetingId,
        participantCount: calendarParticipants.length,
        matchedProfiles: emailProfiles.size,
      }, 'Loaded calendar participant profiles');
    }

    // Step 3: Detect names from introductions
    const detections = this.nameDetector.detectWithIntroductionFocus(segments);

    for (const [speakerLabel, detection] of detections) {
      // Skip if already has a manual alias
      if (speakerMap.has(speakerLabel)) {
        continue;
      }

      try {
        // Find or create voice profile
        const profile = await this.findOrCreateByName(
          organizationId,
          detection.name,
          meetingId
        );

        // Record the match
        await this.recordMatch({
          meetingId,
          speakerLabel,
          voiceProfileId: profile.id,
          matchMethod: 'introduction',
          confidence: detection.confidence,
          detectedPhrase: detection.phrase,
          detectedAt: detection.timestamp,
        });

        speakerMap.set(speakerLabel, detection.name);

        if (profile.sampleCount === 1) {
          newProfiles.push(profile.id);
        } else {
          matchedProfiles.push(profile.id);
        }

        logger.info({
          meetingId,
          speakerLabel,
          name: detection.name,
          confidence: detection.confidence,
          pattern: detection.patternUsed,
        }, 'Detected speaker name');

      } catch (error) {
        logger.error({
          error,
          speakerLabel,
          name: detection.name,
        }, 'Failed to create/match voice profile');
      }
    }

    // Step 4: For unidentified speakers, try voice matching (if we have embeddings)
    const unidentifiedSpeakers = speakers.filter(s => !speakerMap.has(s));

    if (unidentifiedSpeakers.length > 0) {
      // TODO: Implement voice embedding matching when available
      // For now, leave as "Speaker N"
      logger.info({
        meetingId,
        unidentified: unidentifiedSpeakers,
      }, 'Speakers without identification');
    }

    return {
      speakerMap,
      detections: [...detections.values()],
      newProfiles,
      matchedProfiles,
    };
  }

  /**
   * Re-process a meeting's speaker recognition
   */
  async reprocessMeeting(meetingId: string): Promise<RecognitionResult> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: true,
      },
    });

    if (!meeting || !meeting.transcript) {
      throw new Error('Meeting or transcript not found');
    }

    // Parse transcript segments
    const segments = this.parseTranscriptSegments(meeting.transcript.fullText);

    return this.recognizeSpeakers(segments, {
      organizationId: meeting.organizationId,
      meetingId: meeting.id,
    });
  }

  /**
   * Parse transcript text into segments
   * Assumes format: "Speaker N: text\n\nSpeaker M: text"
   */
  private parseTranscriptSegments(fullText: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const pattern = /^(Speaker \d+):\s*(.+?)(?=\n\n|$)/gms;

    let match;
    let timestamp = 0;

    while ((match = pattern.exec(fullText)) !== null) {
      const text = match[2].trim();
      const duration = text.split(/\s+/).length * 0.3; // Rough estimate: 0.3s per word

      segments.push({
        speaker: match[1],
        text,
        startTime: timestamp,
        endTime: timestamp + duration,
      });

      timestamp += duration + 1; // Add 1s gap between segments
    }

    return segments;
  }

  /**
   * Update custom name patterns for an organization
   */
  async updateOrgPatterns(
    organizationId: string,
    patterns: Array<{ pattern: string; nameGroup: number; priority: number }>
  ): Promise<void> {
    // Clear existing custom patterns
    await prisma.namePattern.deleteMany({
      where: { organizationId },
    });

    // Insert new patterns
    await prisma.namePattern.createMany({
      data: patterns.map(p => ({
        organizationId,
        pattern: p.pattern,
        nameGroup: p.nameGroup,
        priority: p.priority,
      })),
    });
  }

  /**
   * Match from calendar participants
   */
  private async matchFromCalendarParticipants(
    organizationId: string,
    participantEmails: string[]
  ): Promise<Map<string, { id: string; displayName: string }>> {
    const profiles = await prisma.voiceProfile.findMany({
      where: {
        organizationId,
        email: { in: participantEmails },
      },
    });

    return new Map(
      profiles
        .filter(p => p.email)
        .map(p => [p.email!, { id: p.id, displayName: p.displayName }])
    );
  }

  /**
   * Find or create a voice profile by name
   */
  private async findOrCreateByName(
    organizationId: string,
    displayName: string,
    meetingId?: string
  ) {
    // Try to find existing profile with similar name
    const existing = await prisma.voiceProfile.findFirst({
      where: {
        organizationId,
        displayName: {
          equals: displayName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      // Update last meeting reference
      if (meetingId) {
        await prisma.voiceProfile.update({
          where: { id: existing.id },
          data: {
            lastMeetingId: meetingId,
            sampleCount: { increment: 1 },
          },
        });
      }
      return existing;
    }

    // Create new profile
    return prisma.voiceProfile.create({
      data: {
        organizationId,
        displayName,
        firstMeetingId: meetingId,
        lastMeetingId: meetingId,
        confidence: 0.5,
      },
    });
  }

  /**
   * Record a speaker match for a meeting
   */
  private async recordMatch(input: {
    meetingId: string;
    speakerLabel: string;
    voiceProfileId: string;
    matchMethod: string;
    confidence: number;
    detectedPhrase?: string;
    detectedAt?: number;
  }) {
    return prisma.speakerMatch.upsert({
      where: {
        meetingId_speakerLabel: {
          meetingId: input.meetingId,
          speakerLabel: input.speakerLabel,
        },
      },
      create: {
        meetingId: input.meetingId,
        speakerLabel: input.speakerLabel,
        voiceProfileId: input.voiceProfileId,
        matchMethod: input.matchMethod,
        confidence: input.confidence,
        detectedPhrase: input.detectedPhrase,
        detectedAt: input.detectedAt,
      },
      update: {
        voiceProfileId: input.voiceProfileId,
        matchMethod: input.matchMethod,
        confidence: input.confidence,
        detectedPhrase: input.detectedPhrase,
        detectedAt: input.detectedAt,
      },
    });
  }
}

export const speakerRecognitionService = new SpeakerRecognitionService();

// Re-export for convenience
export type { TranscriptSegment, DetectedName };
