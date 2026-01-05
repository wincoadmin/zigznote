/**
 * Feature flag service for admin management
 */

import { featureFlagRepository } from '@zigznote/database';
import type { FeatureFlag } from '@zigznote/database';
import type { PaginatedResult, FeatureFlagFilter } from '@zigznote/database';
import { auditService, AuditActions, type AuditContext } from './auditService';
import { AppError } from '../utils/errors';

export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  percentage?: number;
  category?: string;
  targetRules?: Array<{ type: string; ids?: string[]; value?: string }>;
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  percentage?: number;
  category?: string;
  targetRules?: Array<{ type: string; ids?: string[]; value?: string }>;
}

export interface FeatureFlagInfo {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  percentage: number;
  targetRules: Array<{ type: string; ids?: string[]; value?: string }>;
  category: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class FeatureFlagService {
  /**
   * List feature flags with pagination
   */
  async listFlags(
    options: { page?: number; limit?: number },
    filter?: FeatureFlagFilter
  ): Promise<PaginatedResult<FeatureFlagInfo>> {
    const result = await featureFlagRepository.findManyPaginated(options, filter);

    return {
      ...result,
      data: result.data.map(this.toFlagInfo),
    };
  }

  /**
   * Get a single feature flag by ID
   */
  async getFlag(id: string): Promise<FeatureFlagInfo | null> {
    const flag = await featureFlagRepository.findById(id);
    return flag ? this.toFlagInfo(flag) : null;
  }

  /**
   * Get a feature flag by key
   */
  async getFlagByKey(key: string): Promise<FeatureFlagInfo | null> {
    const flag = await featureFlagRepository.findByKey(key);
    return flag ? this.toFlagInfo(flag) : null;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    input: CreateFeatureFlagInput,
    adminId: string,
    context: AuditContext
  ): Promise<FeatureFlagInfo> {
    // Check for duplicate key
    const existing = await featureFlagRepository.findByKey(input.key);
    if (existing) {
      throw new AppError(`Feature flag with key '${input.key}' already exists`, 409, 'DUPLICATE_KEY');
    }

    const created = await featureFlagRepository.create({
      key: input.key,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? false,
      percentage: input.percentage ?? 100,
      category: input.category ?? 'general',
      targetRules: input.targetRules ?? [],
      createdBy: adminId,
    });

    await auditService.log(context, {
      action: AuditActions.FEATURE_FLAG_CREATED,
      entityType: 'feature_flag',
      entityId: created.id,
      newData: {
        key: input.key,
        name: input.name,
        enabled: input.enabled ?? false,
      },
    });

    return this.toFlagInfo(created);
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    id: string,
    input: UpdateFeatureFlagInput,
    context: AuditContext
  ): Promise<FeatureFlagInfo> {
    const existing = await featureFlagRepository.findById(id);
    if (!existing) {
      throw new AppError('Feature flag not found', 404, 'FLAG_NOT_FOUND');
    }

    const previousData: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      previousData.name = existing.name;
      updateData.name = input.name;
    }

    if (input.description !== undefined) {
      previousData.description = existing.description;
      updateData.description = input.description;
    }

    if (input.enabled !== undefined) {
      previousData.enabled = existing.enabled;
      updateData.enabled = input.enabled;
    }

    if (input.percentage !== undefined) {
      previousData.percentage = existing.percentage;
      updateData.percentage = input.percentage;
    }

    if (input.category !== undefined) {
      previousData.category = existing.category;
      updateData.category = input.category;
    }

    if (input.targetRules !== undefined) {
      previousData.targetRules = existing.targetRules;
      updateData.targetRules = input.targetRules;
    }

    const updated = await featureFlagRepository.update(id, updateData);

    await auditService.log(context, {
      action: AuditActions.FEATURE_FLAG_UPDATED,
      entityType: 'feature_flag',
      entityId: id,
      previousData,
      newData: updateData,
    });

    return this.toFlagInfo(updated);
  }

  /**
   * Toggle a feature flag
   */
  async toggleFlag(id: string, context: AuditContext): Promise<FeatureFlagInfo> {
    const existing = await featureFlagRepository.findById(id);
    if (!existing) {
      throw new AppError('Feature flag not found', 404, 'FLAG_NOT_FOUND');
    }

    const toggled = await featureFlagRepository.toggle(id);

    await auditService.log(context, {
      action: AuditActions.FEATURE_FLAG_TOGGLED,
      entityType: 'feature_flag',
      entityId: id,
      previousData: { enabled: existing.enabled },
      newData: { enabled: toggled.enabled },
    });

    return this.toFlagInfo(toggled);
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(id: string, context: AuditContext): Promise<void> {
    const existing = await featureFlagRepository.findById(id);
    if (!existing) {
      throw new AppError('Feature flag not found', 404, 'FLAG_NOT_FOUND');
    }

    await featureFlagRepository.delete(id);

    await auditService.log(context, {
      action: AuditActions.FEATURE_FLAG_DELETED,
      entityType: 'feature_flag',
      entityId: id,
      previousData: {
        key: existing.key,
        name: existing.name,
        enabled: existing.enabled,
      },
    });
  }

  /**
   * Check if a flag is enabled for a context
   */
  async isEnabled(
    key: string,
    context?: { organizationId?: string; userId?: string; plan?: string }
  ): Promise<boolean> {
    return featureFlagRepository.isEnabled(key, context);
  }

  /**
   * Get all enabled flags
   */
  async getEnabledFlags(): Promise<FeatureFlagInfo[]> {
    const flags = await featureFlagRepository.getEnabledFlags();
    return flags.map(this.toFlagInfo);
  }

  /**
   * Get flags by category
   */
  async getFlagsByCategory(category: string): Promise<FeatureFlagInfo[]> {
    const flags = await featureFlagRepository.findByCategory(category);
    return flags.map(this.toFlagInfo);
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const allFlags = await featureFlagRepository.findMany();
    const categories = new Set(allFlags.map((f) => f.category));
    return Array.from(categories).sort();
  }

  /**
   * Get flag statistics
   */
  async getFlagStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  }> {
    const allFlags = await featureFlagRepository.findMany();

    const stats = {
      total: allFlags.length,
      enabled: 0,
      disabled: 0,
      byCategory: {} as Record<string, number>,
    };

    for (const flag of allFlags) {
      if (flag.enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }

      stats.byCategory[flag.category] = (stats.byCategory[flag.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Convert to flag info DTO
   */
  private toFlagInfo(flag: FeatureFlag): FeatureFlagInfo {
    return {
      id: flag.id,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      percentage: flag.percentage,
      targetRules: (flag.targetRules as Array<{ type: string; ids?: string[]; value?: string }>) || [],
      category: flag.category,
      createdBy: flag.createdBy,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    };
  }
}

export const featureFlagService = new FeatureFlagService();
