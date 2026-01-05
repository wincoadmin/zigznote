/**
 * Feature flag repository
 * Handles CRUD for feature flags and toggles
 */

import type { FeatureFlag, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateFeatureFlagInput,
  UpdateFeatureFlagInput,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

export interface FeatureFlagFilter {
  category?: string | string[];
  enabled?: boolean;
  search?: string;
}

export class FeatureFlagRepository {
  /**
   * Find feature flag by ID
   */
  async findById(id: string): Promise<FeatureFlag | null> {
    return prisma.featureFlag.findUnique({
      where: { id },
    });
  }

  /**
   * Find feature flag by key
   */
  async findByKey(key: string): Promise<FeatureFlag | null> {
    return prisma.featureFlag.findUnique({
      where: { key },
    });
  }

  /**
   * Find all feature flags with optional filters
   */
  async findMany(
    filter?: FeatureFlagFilter,
    orderBy?: Prisma.FeatureFlagOrderByWithRelationInput
  ): Promise<FeatureFlag[]> {
    const where = this.buildWhereClause(filter);
    return prisma.featureFlag.findMany({
      where,
      orderBy: orderBy || { key: 'asc' },
    });
  }

  /**
   * Find feature flags with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: FeatureFlagFilter,
    orderBy?: Prisma.FeatureFlagOrderByWithRelationInput
  ): Promise<PaginatedResult<FeatureFlag>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.featureFlag.findMany({
        where,
        orderBy: orderBy || { key: 'asc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.featureFlag.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Create new feature flag
   */
  async create(data: CreateFeatureFlagInput): Promise<FeatureFlag> {
    return prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? false,
        percentage: data.percentage ?? 100,
        targetRules: data.targetRules || [],
        category: data.category || 'general',
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Update feature flag
   */
  async update(id: string, data: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    const updateData: Prisma.FeatureFlagUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.percentage !== undefined) updateData.percentage = data.percentage;
    if (data.targetRules !== undefined) updateData.targetRules = data.targetRules;
    if (data.category !== undefined) updateData.category = data.category;

    return prisma.featureFlag.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete feature flag
   */
  async delete(id: string): Promise<void> {
    await prisma.featureFlag.delete({
      where: { id },
    });
  }

  /**
   * Toggle feature flag on/off
   */
  async toggle(id: string): Promise<FeatureFlag> {
    const flag = await this.findById(id);
    if (!flag) throw new Error('Feature flag not found');

    return prisma.featureFlag.update({
      where: { id },
      data: { enabled: !flag.enabled },
    });
  }

  /**
   * Get all enabled flags (for runtime evaluation)
   */
  async getEnabledFlags(): Promise<FeatureFlag[]> {
    return prisma.featureFlag.findMany({
      where: { enabled: true },
    });
  }

  /**
   * Get flags by category
   */
  async findByCategory(category: string): Promise<FeatureFlag[]> {
    return prisma.featureFlag.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Check if a flag is enabled for a specific context
   * This is a simple implementation - can be extended for more complex rules
   */
  async isEnabled(
    key: string,
    context?: { organizationId?: string; userId?: string; plan?: string }
  ): Promise<boolean> {
    const flag = await this.findByKey(key);
    if (!flag || !flag.enabled) return false;

    // Check percentage rollout (simple hash-based)
    if (flag.percentage < 100 && context?.organizationId) {
      const hash = this.simpleHash(context.organizationId + key);
      const bucket = hash % 100;
      if (bucket >= flag.percentage) return false;
    }

    // Check target rules
    const rules = flag.targetRules as Array<{ type: string; ids?: string[]; value?: string }>;
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (rule.type === 'org' && rule.ids && context?.organizationId) {
          if (rule.ids.includes(context.organizationId)) return true;
        }
        if (rule.type === 'user' && rule.ids && context?.userId) {
          if (rule.ids.includes(context.userId)) return true;
        }
        if (rule.type === 'plan' && rule.value && context?.plan) {
          if (rule.value === context.plan) return true;
        }
      }
      // If we have rules but none matched, disable for this context
      return false;
    }

    return true;
  }

  /**
   * Simple hash function for percentage rollout
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private buildWhereClause(filter?: FeatureFlagFilter): Prisma.FeatureFlagWhereInput {
    if (!filter) return {};

    const where: Prisma.FeatureFlagWhereInput = {};

    if (filter.category) {
      where.category = Array.isArray(filter.category)
        ? { in: filter.category }
        : filter.category;
    }

    if (filter.enabled !== undefined) {
      where.enabled = filter.enabled;
    }

    if (filter.search) {
      where.OR = [
        { key: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}

export const featureFlagRepository = new FeatureFlagRepository();
