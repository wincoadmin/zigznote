/**
 * @ownership
 * @domain Custom Vocabulary Data Access
 * @description Database operations for custom vocabulary terms (Deepgram keywords)
 * @single-responsibility YES — all CustomVocabulary database operations
 */

import type { CustomVocabulary } from '@prisma/client';
import { prisma } from '../client';
import type {
  CreateCustomVocabularyInput,
  UpdateCustomVocabularyInput,
} from '../types';

export class CustomVocabularyRepository {
  /**
   * Create a new vocabulary term
   * @param data Custom vocabulary data
   * @returns Created vocabulary term
   */
  async create(data: CreateCustomVocabularyInput): Promise<CustomVocabulary> {
    return prisma.customVocabulary.create({ data });
  }

  /**
   * Create or update a vocabulary term
   * Uses the unique constraint on [organizationId, term]
   * @param data Vocabulary data with required organizationId and term
   * @returns Created or updated vocabulary term
   */
  async upsert(data: CreateCustomVocabularyInput): Promise<CustomVocabulary> {
    return prisma.customVocabulary.upsert({
      where: {
        organizationId_term: {
          organizationId: data.organizationId,
          term: data.term,
        },
      },
      update: {
        boost: data.boost,
        category: data.category,
      },
      create: data,
    });
  }

  /**
   * Find vocabulary term by ID
   * @param id Vocabulary ID
   * @returns Vocabulary term or null
   */
  async findById(id: string): Promise<CustomVocabulary | null> {
    return prisma.customVocabulary.findUnique({ where: { id } });
  }

  /**
   * Find all vocabulary terms for an organization
   * @param organizationId Organization ID
   * @returns Array of vocabulary terms
   */
  async findByOrganization(organizationId: string): Promise<CustomVocabulary[]> {
    return prisma.customVocabulary.findMany({
      where: { organizationId },
      orderBy: { term: 'asc' },
    });
  }

  /**
   * Find vocabulary terms by category
   * @param organizationId Organization ID
   * @param category Category to filter by
   * @returns Array of vocabulary terms in that category
   */
  async findByCategory(
    organizationId: string,
    category: string
  ): Promise<CustomVocabulary[]> {
    return prisma.customVocabulary.findMany({
      where: { organizationId, category },
      orderBy: { term: 'asc' },
    });
  }

  /**
   * Get vocabulary terms formatted for Deepgram keywords API
   * @param organizationId Organization ID
   * @returns Array of keyword objects for Deepgram
   */
  async getDeepgramKeywords(
    organizationId: string
  ): Promise<Array<{ keyword: string; boost: number }>> {
    const terms = await this.findByOrganization(organizationId);
    return terms.map((t) => ({
      keyword: t.term,
      boost: t.boost,
    }));
  }

  /**
   * Update a vocabulary term
   * @param id Vocabulary ID
   * @param data Updated fields
   * @returns Updated vocabulary term
   */
  async update(
    id: string,
    data: UpdateCustomVocabularyInput
  ): Promise<CustomVocabulary> {
    return prisma.customVocabulary.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a vocabulary term by ID
   * @param id Vocabulary ID
   */
  async delete(id: string): Promise<void> {
    await prisma.customVocabulary.delete({ where: { id } });
  }

  /**
   * Delete all vocabulary terms for an organization
   * @param organizationId Organization ID
   * @returns Number of deleted records
   */
  async deleteByOrganization(organizationId: string): Promise<number> {
    const result = await prisma.customVocabulary.deleteMany({
      where: { organizationId },
    });
    return result.count;
  }

  /**
   * Bulk create vocabulary terms
   * @param terms Array of vocabulary term data
   * @returns Array of created vocabulary terms
   */
  async bulkCreate(
    terms: CreateCustomVocabularyInput[]
  ): Promise<CustomVocabulary[]> {
    const results: CustomVocabulary[] = [];
    for (const term of terms) {
      const result = await this.upsert(term);
      results.push(result);
    }
    return results;
  }

  /**
   * Count vocabulary terms for an organization
   * @param organizationId Organization ID
   * @returns Number of vocabulary terms
   */
  async count(organizationId: string): Promise<number> {
    return prisma.customVocabulary.count({
      where: { organizationId },
    });
  }
}

export const customVocabularyRepository = new CustomVocabularyRepository();
