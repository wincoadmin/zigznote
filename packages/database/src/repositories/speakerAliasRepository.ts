/**
 * @ownership
 * @domain Speaker Alias Data Access
 * @description Database operations for speaker aliases (mapping speaker labels to names)
 * @single-responsibility YES — all SpeakerAlias database operations
 */

import type { SpeakerAlias } from '@prisma/client';
import { prisma } from '../client';
import type { CreateSpeakerAliasInput, UpdateSpeakerAliasInput } from '../types';

export class SpeakerAliasRepository {
  /**
   * Create a new speaker alias
   * @param data Speaker alias data
   * @returns Created speaker alias
   */
  async create(data: CreateSpeakerAliasInput): Promise<SpeakerAlias> {
    return prisma.speakerAlias.create({ data });
  }

  /**
   * Create or update a speaker alias
   * Uses the unique constraint on [organizationId, speakerLabel]
   * @param data Speaker alias data with required organizationId and speakerLabel
   * @returns Created or updated speaker alias
   */
  async upsert(data: CreateSpeakerAliasInput): Promise<SpeakerAlias> {
    return prisma.speakerAlias.upsert({
      where: {
        organizationId_speakerLabel: {
          organizationId: data.organizationId,
          speakerLabel: data.speakerLabel,
        },
      },
      update: {
        displayName: data.displayName,
        email: data.email,
        meetingId: data.meetingId,
        confidence: data.confidence,
      },
      create: data,
    });
  }

  /**
   * Find speaker alias by ID
   * @param id Speaker alias ID
   * @returns Speaker alias or null
   */
  async findById(id: string): Promise<SpeakerAlias | null> {
    return prisma.speakerAlias.findUnique({ where: { id } });
  }

  /**
   * Find all speaker aliases for an organization
   * @param organizationId Organization ID
   * @returns Array of speaker aliases
   */
  async findByOrganization(organizationId: string): Promise<SpeakerAlias[]> {
    return prisma.speakerAlias.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find speaker aliases as a Map for quick lookup
   * @param organizationId Organization ID
   * @returns Map of speakerLabel -> displayName
   */
  async findByOrganizationAsMap(
    organizationId: string
  ): Promise<Map<string, string>> {
    const aliases = await this.findByOrganization(organizationId);
    return new Map(aliases.map((a) => [a.speakerLabel, a.displayName]));
  }

  /**
   * Find speaker aliases for a specific meeting
   * @param meetingId Meeting ID
   * @returns Array of speaker aliases identified in that meeting
   */
  async findByMeeting(meetingId: string): Promise<SpeakerAlias[]> {
    return prisma.speakerAlias.findMany({
      where: { meetingId },
      orderBy: { speakerLabel: 'asc' },
    });
  }

  /**
   * Update a speaker alias
   * @param id Speaker alias ID
   * @param data Updated fields
   * @returns Updated speaker alias
   */
  async update(id: string, data: UpdateSpeakerAliasInput): Promise<SpeakerAlias> {
    return prisma.speakerAlias.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a speaker alias by ID
   * @param id Speaker alias ID
   */
  async delete(id: string): Promise<void> {
    await prisma.speakerAlias.delete({ where: { id } });
  }

  /**
   * Delete all speaker aliases for an organization
   * @param organizationId Organization ID
   * @returns Number of deleted records
   */
  async deleteByOrganization(organizationId: string): Promise<number> {
    const result = await prisma.speakerAlias.deleteMany({
      where: { organizationId },
    });
    return result.count;
  }

  /**
   * Bulk upsert speaker aliases
   * @param aliases Array of speaker alias data
   * @returns Array of created/updated speaker aliases
   */
  async bulkUpsert(aliases: CreateSpeakerAliasInput[]): Promise<SpeakerAlias[]> {
    const results: SpeakerAlias[] = [];
    for (const alias of aliases) {
      const result = await this.upsert(alias);
      results.push(result);
    }
    return results;
  }
}

export const speakerAliasRepository = new SpeakerAliasRepository();
