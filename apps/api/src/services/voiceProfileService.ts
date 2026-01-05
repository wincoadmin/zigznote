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
   * Get a voice profile by ID
   */
  async getProfile(id: string): Promise<VoiceProfile | null> {
    return prisma.voiceProfile.findUnique({
      where: { id },
    });
  }

  /**
   * Get a voice profile with its speaker matches
   */
  async getProfileWithMatches(id: string): Promise<(VoiceProfile & { speakerMatches: Array<SpeakerMatch & { meeting: { id: string; title: string; createdAt: Date } }> }) | null> {
    return prisma.voiceProfile.findUnique({
      where: { id },
      include: {
        speakerMatches: {
          include: { meeting: { select: { id: true, title: true, createdAt: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Update a voice profile
   */
  async updateProfile(id: string, data: { displayName?: string; email?: string | null }): Promise<VoiceProfile> {
    return prisma.voiceProfile.update({
      where: { id },
      data,
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

  /**
   * Get a speaker match
   */
  async getSpeakerMatch(meetingId: string, speakerLabel: string): Promise<SpeakerMatch | null> {
    return prisma.speakerMatch.findUnique({
      where: {
        meetingId_speakerLabel: {
          meetingId,
          speakerLabel,
        },
      },
    });
  }
}

export const voiceProfileService = new VoiceProfileService();
