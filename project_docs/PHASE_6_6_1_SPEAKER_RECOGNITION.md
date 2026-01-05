# Phase 6.6.1: Intelligent Speaker Recognition

**Goal:** Automatically identify speakers from verbal introductions and persist voice profiles for cross-meeting recognition.

**Model:** Default

---

## Pre-Phase Checklist

- [ ] Read PHASE_6_6_COMPLETE.md
- [ ] Read project_docs/GOVERNANCE.md
- [ ] Verify Phase 6.6 (Transcript Polish) is complete
- [ ] Verify current tests pass: `pnpm test`

---

## Mandatory Updates (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_6_6_1_COMPLETE.md with summary and key decisions
2. **Update project_docs/PHASES.md**:
   - Add Phase 6.6.1 section after Phase 6.6
   - Add row to Summary Table: `| 6.6.1 | Speaker Recognition | ✅ | 45-60 min |`
   - Update Total Estimated Time
   - Add entry to Change Log
3. Run all tests and record coverage

---

## Why This Matters

**Current state:** Transcripts show "Speaker 0", "Speaker 1" — users must manually rename.

**Competitor state (Circleback):** Auto-detects "Hi, I'm Sarah" and labels all of Sarah's speech automatically. Remembers Sarah's voice for future meetings.

**After this phase:**
- Auto-detect names from introductions
- Label entire transcript with real names
- Remember voices across meetings
- Summary says "Sarah suggested..." not "Speaker 0 suggested..."

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md

=== TASK LIST (Execute All) ===

---

## SECTION A: Database Schema

**6.6.1.1 Voice Profile Schema**

Add to packages/database/prisma/schema.prisma:

```prisma
// ============================================
// Voice Profiles for Speaker Recognition
// ============================================

// Stored voice profile for cross-meeting recognition
model VoiceProfile {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  
  // Identity
  displayName    String   @map("display_name")  // "Sarah Johnson"
  email          String?                         // Link to known user if possible
  userId         String?  @map("user_id")        // Link to User if internal
  
  // Voice characteristics (from Deepgram or computed)
  voiceEmbedding Bytes?   @map("voice_embedding") // Binary embedding vector
  voiceHash      String?  @map("voice_hash")      // Quick comparison hash
  
  // Learning metadata
  sampleCount    Int      @default(1) @map("sample_count")  // How many meetings used to build profile
  totalDuration  Int      @default(0) @map("total_duration") // Total seconds of speech analyzed
  confidence     Float    @default(0.5)                      // 0-1 confidence in this profile
  
  // Source tracking
  firstMeetingId String?  @map("first_meeting_id")
  lastMeetingId  String?  @map("last_meeting_id")
  
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  firstMeeting   Meeting?     @relation("FirstMeeting", fields: [firstMeetingId], references: [id], onDelete: SetNull)
  lastMeeting    Meeting?     @relation("LastMeeting", fields: [lastMeetingId], references: [id], onDelete: SetNull)
  speakerMatches SpeakerMatch[]

  @@unique([organizationId, email])
  @@index([organizationId])
  @@index([voiceHash])
  @@map("voice_profiles")
}

// Speaker match for a specific meeting
model SpeakerMatch {
  id             String   @id @default(uuid())
  meetingId      String   @map("meeting_id")
  voiceProfileId String   @map("voice_profile_id")
  
  // Match details
  speakerLabel   String   @map("speaker_label")  // "Speaker 0", "Speaker 1"
  matchMethod    String   @map("match_method")   // "introduction", "voice_match", "calendar", "manual"
  confidence     Float    @default(1.0)          // How confident we are in this match
  
  // Detection context
  detectedPhrase String?  @map("detected_phrase") // "Hi, I'm Sarah" - the phrase that identified them
  detectedAt     Float?   @map("detected_at")     // Timestamp in audio where detected
  
  createdAt      DateTime @default(now()) @map("created_at")

  meeting        Meeting      @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  voiceProfile   VoiceProfile @relation(fields: [voiceProfileId], references: [id], onDelete: Cascade)

  @@unique([meetingId, speakerLabel])
  @@unique([meetingId, voiceProfileId])
  @@index([meetingId])
  @@map("speaker_matches")
}

// Name detection patterns (configurable per org)
model NamePattern {
  id             String   @id @default(uuid())
  organizationId String?  @map("organization_id") // null = global pattern
  
  pattern        String   // Regex pattern
  nameGroup      Int      @default(1) @map("name_group") // Capture group for name
  priority       Int      @default(0) // Higher = checked first
  isActive       Boolean  @default(true) @map("is_active")
  
  createdAt      DateTime @default(now()) @map("created_at")

  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("name_patterns")
}
```

Update Organization model:
```prisma
model Organization {
  // ... existing fields ...
  voiceProfiles VoiceProfile[]
  namePatterns  NamePattern[]
}
```

Update User model:
```prisma
model User {
  // ... existing fields ...
  voiceProfiles VoiceProfile[]
}
```

Update Meeting model:
```prisma
model Meeting {
  // ... existing fields ...
  speakerMatches     SpeakerMatch[]
  voiceProfilesFirst VoiceProfile[] @relation("FirstMeeting")
  voiceProfilesLast  VoiceProfile[] @relation("LastMeeting")
}
```

Run migration:
```bash
pnpm db:migrate --name add_voice_profiles
```

---

## SECTION B: Name Detection Service

**6.6.1.2 Name Detection Patterns**

Create services/transcription/src/nameDetector.ts:

```typescript
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
 * Built-in patterns for detecting speaker introductions
 * Ordered by specificity (most specific first)
 */
const DEFAULT_PATTERNS: Array<{ regex: RegExp; nameGroup: number; confidence: number; id: string }> = [
  // Direct introductions
  {
    id: 'intro_im',
    regex: /\b(?:hi|hey|hello|good\s+(?:morning|afternoon|evening))[,.\s]+(?:everyone[,.\s]+)?(?:i'm|i\s+am|this\s+is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    nameGroup: 1,
    confidence: 0.95,
  },
  {
    id: 'intro_name_is',
    regex: /\b(?:my\s+name\s+is|my\s+name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    nameGroup: 1,
    confidence: 0.95,
  },
  {
    id: 'intro_this_is',
    regex: /\bthis\s+is\s+([A-Z][a-z]+)(?:\s+(?:from|at|with|speaking))/i,
    nameGroup: 1,
    confidence: 0.9,
  },
  {
    id: 'intro_speaking',
    regex: /\b([A-Z][a-z]+)\s+(?:here|speaking)(?:\s|$|,|\.)/i,
    nameGroup: 1,
    confidence: 0.85,
  },
  // Meeting-specific patterns
  {
    id: 'intro_joining',
    regex: /\b([A-Z][a-z]+)\s+(?:joining|hopping\s+on|jumping\s+on)(?:\s+(?:from|the|a))?/i,
    nameGroup: 1,
    confidence: 0.8,
  },
  {
    id: 'intro_its',
    regex: /\b(?:it's|its)\s+([A-Z][a-z]+)(?:\s+(?:here|from|at))?(?:\s|$|,|\.)/i,
    nameGroup: 1,
    confidence: 0.75,
  },
  // Context from others addressing someone
  {
    id: 'thanks_name',
    regex: /\b(?:thanks|thank\s+you)[,\s]+([A-Z][a-z]+)/i,
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
  const normalized = name.toLowerCase().trim();
  
  // Must be at least 2 characters
  if (normalized.length < 2) return false;
  
  // Must not be a known false positive
  if (FALSE_POSITIVE_NAMES.has(normalized)) return false;
  
  // Must start with a letter
  if (!/^[a-z]/i.test(name)) return false;
  
  // Must not be all caps (likely acronym)
  if (name === name.toUpperCase() && name.length > 2) return false;
  
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
```

---

## SECTION C: Voice Profile Service

**6.6.1.3 Voice Profile Service**

Create apps/api/src/services/voiceProfileService.ts:

```typescript
/**
 * @ownership
 * @domain Voice Profile Management
 * @description Manages voice profiles for cross-meeting speaker recognition
 * @single-responsibility YES — voice profile CRUD and matching
 */

import { prisma } from '@zigznote/database';
import type { VoiceProfile, SpeakerMatch } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateVoiceProfileInput {
  organizationId: string;
  displayName: string;
  email?: string;
  userId?: string;
  meetingId?: string;
  voiceEmbedding?: Buffer;
  voiceHash?: string;
  confidence?: number;
}

export interface MatchSpeakerInput {
  meetingId: string;
  speakerLabel: string;
  voiceProfileId: string;
  matchMethod: 'introduction' | 'voice_match' | 'calendar' | 'manual';
  confidence: number;
  detectedPhrase?: string;
  detectedAt?: number;
}

export interface SpeakerIdentification {
  speakerLabel: string;
  displayName: string;
  confidence: number;
  matchMethod: string;
  voiceProfileId: string;
}

class VoiceProfileService {
  /**
   * Create a new voice profile
   */
  async createProfile(input: CreateVoiceProfileInput): Promise<VoiceProfile> {
    return prisma.voiceProfile.create({
      data: {
        organizationId: input.organizationId,
        displayName: input.displayName,
        email: input.email,
        userId: input.userId,
        firstMeetingId: input.meetingId,
        lastMeetingId: input.meetingId,
        voiceEmbedding: input.voiceEmbedding,
        voiceHash: input.voiceHash,
        confidence: input.confidence ?? 0.5,
      },
    });
  }

  /**
   * Find or create a voice profile by name and org
   */
  async findOrCreateByName(
    organizationId: string,
    displayName: string,
    meetingId?: string
  ): Promise<VoiceProfile> {
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
    return this.createProfile({
      organizationId,
      displayName,
      meetingId,
    });
  }

  /**
   * Record a speaker match for a meeting
   */
  async recordMatch(input: MatchSpeakerInput): Promise<SpeakerMatch> {
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

  /**
   * Get all speaker identifications for a meeting
   */
  async getMeetingSpeakers(meetingId: string): Promise<SpeakerIdentification[]> {
    const matches = await prisma.speakerMatch.findMany({
      where: { meetingId },
      include: { voiceProfile: true },
    });

    return matches.map(m => ({
      speakerLabel: m.speakerLabel,
      displayName: m.voiceProfile.displayName,
      confidence: m.confidence,
      matchMethod: m.matchMethod,
      voiceProfileId: m.voiceProfileId,
    }));
  }

  /**
   * Get speaker alias map for a meeting (for transcript display)
   */
  async getSpeakerAliasMap(meetingId: string): Promise<Map<string, string>> {
    const speakers = await this.getMeetingSpeakers(meetingId);
    return new Map(speakers.map(s => [s.speakerLabel, s.displayName]));
  }

  /**
   * Get all voice profiles for an organization
   */
  async getOrgProfiles(organizationId: string): Promise<VoiceProfile[]> {
    return prisma.voiceProfile.findMany({
      where: { organizationId },
      orderBy: { displayName: 'asc' },
    });
  }

  /**
   * Find profiles that might match based on calendar participants
   */
  async matchFromCalendarParticipants(
    organizationId: string,
    participantEmails: string[]
  ): Promise<Map<string, VoiceProfile>> {
    const profiles = await prisma.voiceProfile.findMany({
      where: {
        organizationId,
        email: { in: participantEmails },
      },
    });

    return new Map(profiles.filter(p => p.email).map(p => [p.email!, p]));
  }

  /**
   * Update profile confidence based on confirmation
   */
  async confirmMatch(voiceProfileId: string, confirmed: boolean): Promise<void> {
    const adjustment = confirmed ? 0.1 : -0.1;
    
    await prisma.voiceProfile.update({
      where: { id: voiceProfileId },
      data: {
        confidence: {
          increment: adjustment,
        },
      },
    });
  }

  /**
   * Merge two voice profiles (when we discover they're the same person)
   */
  async mergeProfiles(keepId: string, mergeId: string): Promise<VoiceProfile> {
    const [keep, merge] = await Promise.all([
      prisma.voiceProfile.findUnique({ where: { id: keepId } }),
      prisma.voiceProfile.findUnique({ where: { id: mergeId } }),
    ]);

    if (!keep || !merge) {
      throw new Error('Profile not found');
    }

    // Move all speaker matches to the kept profile
    await prisma.speakerMatch.updateMany({
      where: { voiceProfileId: mergeId },
      data: { voiceProfileId: keepId },
    });

    // Update kept profile with combined data
    const updated = await prisma.voiceProfile.update({
      where: { id: keepId },
      data: {
        sampleCount: keep.sampleCount + merge.sampleCount,
        totalDuration: keep.totalDuration + merge.totalDuration,
        confidence: Math.max(keep.confidence, merge.confidence),
        email: keep.email || merge.email,
      },
    });

    // Delete merged profile
    await prisma.voiceProfile.delete({ where: { id: mergeId } });

    return updated;
  }

  /**
   * Delete a voice profile
   */
  async deleteProfile(id: string): Promise<void> {
    await prisma.voiceProfile.delete({ where: { id } });
  }
}

export const voiceProfileService = new VoiceProfileService();
```

---

## SECTION D: Speaker Recognition Integration

**6.6.1.4 Speaker Recognition Processor**

Create services/transcription/src/speakerRecognition.ts:

```typescript
/**
 * @ownership
 * @domain Speaker Recognition
 * @description Orchestrates name detection and voice profile matching
 * @single-responsibility YES — speaker recognition pipeline
 */

import { NameDetector, DetectedName } from './nameDetector';
import { voiceProfileService } from '../../../apps/api/src/services/voiceProfileService';
import { prisma } from '@zigznote/database';
import { logger } from '../../../apps/api/src/utils/logger';

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

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
      const emailProfiles = await voiceProfileService.matchFromCalendarParticipants(
        organizationId,
        calendarParticipants
      );
      
      // We know WHO should be in the meeting, but not which speaker label they are
      // This will be resolved by name detection or voice matching
      logger.info({ 
        meetingId, 
        participantCount: calendarParticipants.length,
        matchedProfiles: emailProfiles.size 
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
        const profile = await voiceProfileService.findOrCreateByName(
          organizationId,
          detection.name,
          meetingId
        );

        // Record the match
        await voiceProfileService.recordMatch({
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
          name: detection.name 
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
}

export const speakerRecognitionService = new SpeakerRecognitionService();
```

---

## SECTION E: Integration with Transcription Pipeline

**6.6.1.5 Update Transcription Processor**

Update services/transcription/src/processor.ts to include speaker recognition:

Add import:
```typescript
import { speakerRecognitionService } from './speakerRecognition';
```

After transcription is complete and before summarization, add:

```typescript
// === SPEAKER RECOGNITION ===
// Run after transcription, before summarization

const recognitionResult = await speakerRecognitionService.recognizeSpeakers(
  transcriptSegments,
  {
    organizationId: job.data.organizationId,
    meetingId: job.data.meetingId,
    // calendarParticipants: meeting.calendarEvent?.participants,
  }
);

logger.info({
  meetingId: job.data.meetingId,
  identifiedSpeakers: recognitionResult.speakerMap.size,
  newProfiles: recognitionResult.newProfiles.length,
}, 'Speaker recognition complete');

// Update the speaker aliases for post-processing
const postProcessor = new TranscriptPostProcessor({
  removeFillers: true,
  cleanSentenceBoundaries: true,
  speakerAliases: recognitionResult.speakerMap,
});

// Apply post-processing with identified names
const processedSegments = postProcessor.processTranscript(transcriptSegments);
```

---

## SECTION F: API Routes

**6.6.1.6 Voice Profile Routes**

Create apps/api/src/routes/voiceProfiles.ts:

```typescript
/**
 * Voice profile management routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { voiceProfileService } from '../services/voiceProfileService';
import { speakerRecognitionService } from '../../../../services/transcription/src/speakerRecognition';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';

export const voiceProfilesRouter: IRouter = Router();

voiceProfilesRouter.use(requireAuth);

const createProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(100),
    email: z.string().email().optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional().nullable(),
  }),
});

const mergeProfilesSchema = z.object({
  body: z.object({
    keepId: z.string().uuid(),
    mergeId: z.string().uuid(),
  }),
});

/**
 * GET /api/v1/voice-profiles
 * List all voice profiles for the organization
 */
voiceProfilesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const profiles = await voiceProfileService.getOrgProfiles(
      authReq.auth!.organizationId
    );
    res.json({ success: true, data: profiles });
  })
);

/**
 * POST /api/v1/voice-profiles
 * Create a new voice profile
 */
voiceProfilesRouter.post(
  '/',
  validateRequest(createProfileSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const profile = await voiceProfileService.createProfile({
      organizationId: authReq.auth!.organizationId,
      displayName: req.body.displayName,
      email: req.body.email,
    });
    res.status(201).json({ success: true, data: profile });
  })
);

/**
 * GET /api/v1/voice-profiles/:id
 * Get a specific voice profile
 */
voiceProfilesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const profile = await prisma.voiceProfile.findUnique({
      where: { id: req.params.id },
      include: {
        speakerMatches: {
          include: { meeting: { select: { id: true, title: true, createdAt: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Voice profile not found' },
      });
    }

    res.json({ success: true, data: profile });
  })
);

/**
 * PATCH /api/v1/voice-profiles/:id
 * Update a voice profile
 */
voiceProfilesRouter.patch(
  '/:id',
  validateRequest(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const profile = await prisma.voiceProfile.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: profile });
  })
);

/**
 * DELETE /api/v1/voice-profiles/:id
 * Delete a voice profile
 */
voiceProfilesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await voiceProfileService.deleteProfile(req.params.id);
    res.json({ success: true, message: 'Voice profile deleted' });
  })
);

/**
 * POST /api/v1/voice-profiles/merge
 * Merge two voice profiles
 */
voiceProfilesRouter.post(
  '/merge',
  validateRequest(mergeProfilesSchema),
  asyncHandler(async (req, res) => {
    const merged = await voiceProfileService.mergeProfiles(
      req.body.keepId,
      req.body.mergeId
    );
    res.json({ success: true, data: merged });
  })
);

/**
 * GET /api/v1/meetings/:meetingId/speakers
 * Get identified speakers for a meeting
 */
voiceProfilesRouter.get(
  '/meetings/:meetingId/speakers',
  asyncHandler(async (req, res) => {
    const speakers = await voiceProfileService.getMeetingSpeakers(req.params.meetingId);
    res.json({ success: true, data: speakers });
  })
);

/**
 * POST /api/v1/meetings/:meetingId/speakers/reprocess
 * Re-run speaker recognition for a meeting
 */
voiceProfilesRouter.post(
  '/meetings/:meetingId/speakers/reprocess',
  asyncHandler(async (req, res) => {
    const result = await speakerRecognitionService.reprocessMeeting(req.params.meetingId);
    res.json({
      success: true,
      data: {
        identifiedSpeakers: Object.fromEntries(result.speakerMap),
        newProfiles: result.newProfiles.length,
        matchedProfiles: result.matchedProfiles.length,
      },
    });
  })
);

/**
 * POST /api/v1/meetings/:meetingId/speakers/:speakerLabel/confirm
 * Confirm or reject a speaker identification
 */
voiceProfilesRouter.post(
  '/meetings/:meetingId/speakers/:speakerLabel/confirm',
  asyncHandler(async (req, res) => {
    const { confirmed } = req.body;
    
    const match = await prisma.speakerMatch.findUnique({
      where: {
        meetingId_speakerLabel: {
          meetingId: req.params.meetingId,
          speakerLabel: req.params.speakerLabel,
        },
      },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Speaker match not found' },
      });
    }

    await voiceProfileService.confirmMatch(match.voiceProfileId, confirmed);
    
    res.json({ success: true, message: confirmed ? 'Match confirmed' : 'Match rejected' });
  })
);

import { prisma } from '@zigznote/database';
```

Register in apps/api/src/routes/api.ts:
```typescript
import { voiceProfilesRouter } from './voiceProfiles';

apiRouter.use('/v1/voice-profiles', voiceProfilesRouter);
```

---

## SECTION G: Tests

**6.6.1.7 Name Detector Tests**

Create services/transcription/tests/nameDetector.test.ts:

```typescript
import { NameDetector } from '../src/nameDetector';

describe('NameDetector', () => {
  const detector = new NameDetector();

  describe('detectInSegment', () => {
    it('should detect "Hi, I\'m [Name]" pattern', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi everyone, I'm Sarah. Thanks for joining.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Sarah');
      expect(result?.speakerLabel).toBe('Speaker 0');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });

    it('should detect "My name is [Name]" pattern', () => {
      const segment = {
        speaker: 'Speaker 1',
        text: "My name is John Smith and I'll be leading this meeting.",
        startTime: 10,
        endTime: 15,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Smith');
    });

    it('should detect "[Name] here" pattern', () => {
      const segment = {
        speaker: 'Speaker 2',
        text: 'Michael here, sorry I was on mute.',
        startTime: 20,
        endTime: 25,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Michael');
    });

    it('should detect "This is [Name] from" pattern', () => {
      const segment = {
        speaker: 'Speaker 3',
        text: 'This is Jennifer from the marketing team.',
        startTime: 30,
        endTime: 35,
      };

      const result = detector.detectInSegment(segment);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Jennifer');
    });

    it('should return null for segments without introductions', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: 'I think we should focus on the Q4 targets.',
        startTime: 100,
        endTime: 105,
      };

      const result = detector.detectInSegment(segment);

      expect(result).toBeNull();
    });

    it('should reject false positive names', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi everyone, I'm here to discuss the Monday deadline.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      // Should not detect "Monday" as a name
      expect(result?.name).not.toBe('Monday');
    });

    it('should normalize detected names', () => {
      const segment = {
        speaker: 'Speaker 0',
        text: "Hi, I'm SARAH from engineering.",
        startTime: 0,
        endTime: 5,
      };

      const result = detector.detectInSegment(segment);

      expect(result?.name).toBe('Sarah');
    });
  });

  describe('detectInTranscript', () => {
    it('should detect multiple speakers', () => {
      const segments = [
        { speaker: 'Speaker 0', text: "Hi, I'm Alice.", startTime: 0, endTime: 2 },
        { speaker: 'Speaker 1', text: "Hello, my name is Bob.", startTime: 3, endTime: 5 },
        { speaker: 'Speaker 0', text: "Thanks for joining, Bob.", startTime: 6, endTime: 8 },
      ];

      const results = detector.detectInTranscript(segments);

      expect(results.size).toBe(2);
      expect(results.get('Speaker 0')?.name).toBe('Alice');
      expect(results.get('Speaker 1')?.name).toBe('Bob');
    });

    it('should prefer higher confidence detections', () => {
      const segments = [
        // Lower confidence detection first
        { speaker: 'Speaker 0', text: "Thanks Sarah", startTime: 0, endTime: 2 },
        // Higher confidence detection later
        { speaker: 'Speaker 0', text: "Actually, I'm Mike.", startTime: 10, endTime: 12 },
      ];

      const results = detector.detectInTranscript(segments);

      // Should keep the higher confidence self-introduction
      expect(results.get('Speaker 0')?.name).toBe('Mike');
    });
  });

  describe('detectWithIntroductionFocus', () => {
    it('should prioritize introduction window', () => {
      const segments = [
        // In intro window (first 5 minutes)
        { speaker: 'Speaker 0', text: "Hi, I'm Sarah.", startTime: 30, endTime: 32 },
        // Late detection (after 5 minutes)
        { speaker: 'Speaker 1', text: "John speaking.", startTime: 400, endTime: 402 },
      ];

      const results = detector.detectWithIntroductionFocus(segments);

      // Early detection should have higher confidence
      expect(results.get('Speaker 0')?.confidence).toBeGreaterThan(
        results.get('Speaker 1')?.confidence || 0
      );
    });
  });
});
```

**6.6.1.8 Voice Profile Service Tests**

Create apps/api/tests/services/voiceProfileService.test.ts:

```typescript
import { voiceProfileService } from '../../src/services/voiceProfileService';
import { prisma } from '@zigznote/database';

// Mock prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    voiceProfile: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    speakerMatch: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe('VoiceProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreateByName', () => {
    it('should return existing profile if found', async () => {
      const existingProfile = {
        id: 'profile-1',
        displayName: 'Sarah',
        organizationId: 'org-1',
      };

      (prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue(existingProfile);
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue(existingProfile);

      const result = await voiceProfileService.findOrCreateByName(
        'org-1',
        'Sarah',
        'meeting-1'
      );

      expect(result.id).toBe('profile-1');
      expect(prisma.voiceProfile.create).not.toHaveBeenCalled();
    });

    it('should create new profile if not found', async () => {
      const newProfile = {
        id: 'profile-2',
        displayName: 'John',
        organizationId: 'org-1',
      };

      (prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.voiceProfile.create as jest.Mock).mockResolvedValue(newProfile);

      const result = await voiceProfileService.findOrCreateByName(
        'org-1',
        'John',
        'meeting-1'
      );

      expect(result.id).toBe('profile-2');
      expect(prisma.voiceProfile.create).toHaveBeenCalled();
    });
  });

  describe('getSpeakerAliasMap', () => {
    it('should return map of speaker labels to names', async () => {
      const matches = [
        { speakerLabel: 'Speaker 0', voiceProfile: { displayName: 'Alice' }, confidence: 0.9, matchMethod: 'introduction' },
        { speakerLabel: 'Speaker 1', voiceProfile: { displayName: 'Bob' }, confidence: 0.85, matchMethod: 'introduction' },
      ];

      (prisma.speakerMatch.findMany as jest.Mock).mockResolvedValue(matches);

      const result = await voiceProfileService.getSpeakerAliasMap('meeting-1');

      expect(result.get('Speaker 0')).toBe('Alice');
      expect(result.get('Speaker 1')).toBe('Bob');
    });
  });
});
```

---

## SECTION H: Frontend Components

**6.6.1.9 Speaker Editor Component**

Create apps/web/components/meetings/SpeakerEditor.tsx:

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Speaker {
  speakerLabel: string;
  displayName: string;
  confidence: number;
  matchMethod: string;
  voiceProfileId: string;
}

interface SpeakerEditorProps {
  meetingId: string;
  speakers: Speaker[];
}

export function SpeakerEditor({ meetingId, speakers }: SpeakerEditorProps) {
  const queryClient = useQueryClient();
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const updateSpeaker = useMutation({
    mutationFn: async ({ speakerLabel, displayName }: { speakerLabel: string; displayName: string }) => {
      // This updates the speaker alias
      return api.put('/api/v1/speakers', {
        speakerLabel,
        displayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      setEditingSpeaker(null);
    },
  });

  const confirmSpeaker = useMutation({
    mutationFn: async ({ speakerLabel, confirmed }: { speakerLabel: string; confirmed: boolean }) => {
      return api.post(`/api/v1/voice-profiles/meetings/${meetingId}/speakers/${speakerLabel}/confirm`, {
        confirmed,
      });
    },
  });

  const reprocessSpeakers = useMutation({
    mutationFn: async () => {
      return api.post(`/api/v1/voice-profiles/meetings/${meetingId}/speakers/reprocess`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'introduction': return '🎤 Detected from introduction';
      case 'voice_match': return '🔊 Matched by voice';
      case 'calendar': return '📅 From calendar';
      case 'manual': return '✏️ Manually set';
      default: return method;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Speakers</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => reprocessSpeakers.mutate()}
          disabled={reprocessSpeakers.isPending}
        >
          {reprocessSpeakers.isPending ? 'Processing...' : 'Re-detect Names'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {speakers.map((speaker) => (
            <div
              key={speaker.speakerLabel}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex-1">
                {editingSpeaker === speaker.speakerLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter name"
                      className="w-48"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        updateSpeaker.mutate({
                          speakerLabel: speaker.speakerLabel,
                          displayName: editName,
                        });
                      }}
                      disabled={!editName.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSpeaker(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{speaker.displayName}</span>
                      <span className="text-xs text-slate-400">({speaker.speakerLabel})</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {getMethodLabel(speaker.matchMethod)}
                      </span>
                      <span className={`text-xs ${getConfidenceColor(speaker.confidence)}`}>
                        {Math.round(speaker.confidence * 100)}% confident
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {editingSpeaker !== speaker.speakerLabel && (
                <div className="flex items-center gap-2">
                  {speaker.matchMethod === 'introduction' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => confirmSpeaker.mutate({ 
                          speakerLabel: speaker.speakerLabel, 
                          confirmed: true 
                        })}
                        title="Confirm this is correct"
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => confirmSpeaker.mutate({ 
                          speakerLabel: speaker.speakerLabel, 
                          confirmed: false 
                        })}
                        title="This is incorrect"
                      >
                        ✗
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingSpeaker(speaker.speakerLabel);
                      setEditName(speaker.displayName);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          ))}

          {speakers.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              No speakers identified yet. Names will be detected from introductions.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] `pnpm db:migrate` runs successfully
- [ ] Name detection patterns work for common introductions
- [ ] Voice profiles are created on first detection
- [ ] Speaker matches are recorded per meeting
- [ ] Transcripts display detected names instead of "Speaker N"
- [ ] Summaries use detected names
- [ ] Speaker editor allows manual corrections
- [ ] Confidence scoring works
- [ ] Tests pass for name detector and voice profile service
- [ ] **PHASES.md updated with Phase 6.6.1 section**
- [ ] PHASE_6_6_1_COMPLETE.md created

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add intelligent speaker recognition

- Auto-detect speaker names from introductions (Hi, I'm Sarah)
- Voice profile storage for cross-meeting recognition
- Speaker match tracking with confidence scores
- Multiple detection patterns with priority ordering
- API routes for voice profile management
- Speaker editor component for manual corrections
- Confirmation workflow to improve detection accuracy
- Integration with transcript post-processing
- Comprehensive tests for name detection"
```

---

## Summary

After completing Phase 6.6.1:

| Feature | Status |
|---------|--------|
| Name detection from "Hi, I'm X" | ✅ |
| Name detection from "My name is X" | ✅ |
| Name detection from "X here/speaking" | ✅ |
| Voice profile creation | ✅ |
| Cross-meeting persistence | ✅ |
| Confidence scoring | ✅ |
| Manual correction UI | ✅ |
| Confirmation workflow | ✅ |

**Before:** "Speaker 0: I think we should proceed with the budget."

**After:** "Sarah: I think we should proceed with the budget."

This matches Circleback's speaker identification capability.

Ready for Phase 6.7: Audio Input Sources.
