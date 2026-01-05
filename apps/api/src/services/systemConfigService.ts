/**
 * System configuration service for admin management
 */

import { systemConfigRepository } from '@zigznote/database';
import type { SystemConfig, Prisma } from '@prisma/client';
import type { PaginatedResult, SystemConfigFilter } from '@zigznote/database';
import { encryptionService } from './encryptionService';
import { auditService, AuditActions, type AuditContext } from './auditService';
import { AppError } from '../utils/errors';

export interface CreateSystemConfigInput {
  key: string;
  value: unknown;
  encrypted?: boolean;
  category?: string;
}

export interface UpdateSystemConfigInput {
  value?: unknown;
  encrypted?: boolean;
  category?: string;
}

export interface SystemConfigInfo {
  id: string;
  key: string;
  value: unknown; // Decrypted if encrypted
  encrypted: boolean;
  category: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class SystemConfigService {
  /**
   * List configs with pagination
   */
  async listConfigs(
    options: { page?: number; limit?: number },
    filter?: SystemConfigFilter
  ): Promise<PaginatedResult<SystemConfigInfo>> {
    const result = await systemConfigRepository.findManyPaginated(options, filter);

    return {
      ...result,
      data: result.data.map((config) => this.toConfigInfo(config)),
    };
  }

  /**
   * Get a single config by ID
   */
  async getConfig(id: string): Promise<SystemConfigInfo | null> {
    const config = await systemConfigRepository.findById(id);
    return config ? this.toConfigInfo(config) : null;
  }

  /**
   * Get a config by key
   */
  async getConfigByKey(key: string): Promise<SystemConfigInfo | null> {
    const config = await systemConfigRepository.findByKey(key);
    return config ? this.toConfigInfo(config) : null;
  }

  /**
   * Get config value (for runtime use)
   */
  async getValue<T = unknown>(key: string): Promise<T | null> {
    const config = await systemConfigRepository.findByKey(key);
    if (!config) return null;

    if (config.encrypted && typeof config.value === 'string') {
      try {
        const decrypted = encryptionService.decrypt(config.value);
        return JSON.parse(decrypted) as T;
      } catch {
        return config.value as T;
      }
    }

    return config.value as T;
  }

  /**
   * Create a new config
   */
  async createConfig(
    input: CreateSystemConfigInput,
    adminId: string,
    context: AuditContext
  ): Promise<SystemConfigInfo> {
    // Check for duplicate key
    const existing = await systemConfigRepository.findByKey(input.key);
    if (existing) {
      throw new AppError(`Config with key '${input.key}' already exists`, 409, 'DUPLICATE_KEY');
    }

    let value: Prisma.InputJsonValue = input.value as Prisma.InputJsonValue;

    // Encrypt if needed
    if (input.encrypted) {
      const stringValue = typeof input.value === 'string'
        ? input.value
        : JSON.stringify(input.value);
      value = encryptionService.encrypt(stringValue);
    }

    const created = await systemConfigRepository.create({
      key: input.key,
      value,
      encrypted: input.encrypted ?? false,
      category: input.category ?? 'general',
      updatedBy: adminId,
    });

    await auditService.log(context, {
      action: AuditActions.CONFIG_UPDATED,
      entityType: 'system_config',
      entityId: created.id,
      newData: {
        key: input.key,
        category: input.category ?? 'general',
        encrypted: input.encrypted ?? false,
      },
      details: { created: true },
    });

    return this.toConfigInfo(created);
  }

  /**
   * Update a config
   */
  async updateConfig(
    id: string,
    input: UpdateSystemConfigInput,
    adminId: string,
    context: AuditContext
  ): Promise<SystemConfigInfo> {
    const existing = await systemConfigRepository.findById(id);
    if (!existing) {
      throw new AppError('Config not found', 404, 'CONFIG_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = { updatedBy: adminId };
    const previousData: Record<string, unknown> = {};

    if (input.value !== undefined) {
      previousData.value = '[REDACTED]'; // Don't log actual values

      let value: Prisma.InputJsonValue = input.value as Prisma.InputJsonValue;
      const shouldEncrypt = input.encrypted ?? existing.encrypted;

      if (shouldEncrypt) {
        const stringValue = typeof input.value === 'string'
          ? input.value
          : JSON.stringify(input.value);
        value = encryptionService.encrypt(stringValue);
      }

      updateData.value = value;
    }

    if (input.encrypted !== undefined) {
      previousData.encrypted = existing.encrypted;
      updateData.encrypted = input.encrypted;
    }

    if (input.category !== undefined) {
      previousData.category = existing.category;
      updateData.category = input.category;
    }

    const updated = await systemConfigRepository.update(id, updateData);

    await auditService.log(context, {
      action: AuditActions.CONFIG_UPDATED,
      entityType: 'system_config',
      entityId: id,
      previousData,
      newData: {
        encrypted: updated.encrypted,
        category: updated.category,
      },
    });

    return this.toConfigInfo(updated);
  }

  /**
   * Set config value by key (upsert)
   */
  async setValue(
    key: string,
    value: unknown,
    adminId: string,
    context: AuditContext,
    options?: { encrypted?: boolean; category?: string }
  ): Promise<SystemConfigInfo> {
    const existing = await systemConfigRepository.findByKey(key);

    let finalValue: Prisma.InputJsonValue = value as Prisma.InputJsonValue;
    const shouldEncrypt = options?.encrypted ?? existing?.encrypted ?? false;

    if (shouldEncrypt) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      finalValue = encryptionService.encrypt(stringValue);
    }

    const config = await systemConfigRepository.upsertByKey(key, {
      value: finalValue,
      encrypted: shouldEncrypt,
      category: options?.category ?? existing?.category ?? 'general',
      updatedBy: adminId,
    });

    await auditService.log(context, {
      action: AuditActions.CONFIG_UPDATED,
      entityType: 'system_config',
      entityId: config.id,
      details: {
        key,
        upserted: !existing,
      },
    });

    return this.toConfigInfo(config);
  }

  /**
   * Delete a config
   */
  async deleteConfig(id: string, context: AuditContext): Promise<void> {
    const existing = await systemConfigRepository.findById(id);
    if (!existing) {
      throw new AppError('Config not found', 404, 'CONFIG_NOT_FOUND');
    }

    await systemConfigRepository.delete(id);

    await auditService.log(context, {
      action: AuditActions.CONFIG_DELETED,
      entityType: 'system_config',
      entityId: id,
      previousData: {
        key: existing.key,
        category: existing.category,
      },
    });
  }

  /**
   * Get configs by category
   */
  async getConfigsByCategory(category: string): Promise<SystemConfigInfo[]> {
    const configs = await systemConfigRepository.findByCategory(category);
    return configs.map((c) => this.toConfigInfo(c));
  }

  /**
   * Get configs by prefix
   */
  async getConfigsByPrefix(prefix: string): Promise<SystemConfigInfo[]> {
    const configs = await systemConfigRepository.findByPrefix(prefix);
    return configs.map((c) => this.toConfigInfo(c));
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const allConfigs = await systemConfigRepository.findMany();
    const categories = new Set(allConfigs.map((c) => c.category));
    return Array.from(categories).sort();
  }

  /**
   * Get config statistics
   */
  async getConfigStats(): Promise<{
    total: number;
    encrypted: number;
    byCategory: Record<string, number>;
  }> {
    const allConfigs = await systemConfigRepository.findMany();

    const stats = {
      total: allConfigs.length,
      encrypted: 0,
      byCategory: {} as Record<string, number>,
    };

    for (const config of allConfigs) {
      if (config.encrypted) {
        stats.encrypted++;
      }

      stats.byCategory[config.category] = (stats.byCategory[config.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Convert to config info DTO
   */
  private toConfigInfo(config: SystemConfig): SystemConfigInfo {
    let value = config.value;

    // Decrypt if needed
    if (config.encrypted && typeof config.value === 'string') {
      try {
        const decrypted = encryptionService.decrypt(config.value);
        try {
          value = JSON.parse(decrypted);
        } catch {
          value = decrypted;
        }
      } catch {
        // If decryption fails, return masked value
        value = '[ENCRYPTED]';
      }
    }

    return {
      id: config.id,
      key: config.key,
      value,
      encrypted: config.encrypted,
      category: config.category,
      updatedBy: config.updatedBy,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}

export const systemConfigService = new SystemConfigService();
