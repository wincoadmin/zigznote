/**
 * System API Key management service
 * Handles CRUD operations for third-party API keys with encryption
 */

import { systemApiKeyRepository } from '@zigznote/database';
import type { SystemApiKey } from '@zigznote/database';
import type { PaginatedResult, SystemApiKeyFilter } from '@zigznote/database';
import { encryptionService } from './encryptionService';
import { auditService, AuditActions, type AuditContext } from './auditService';
import { AppError } from '../utils/errors';

/**
 * Known API providers
 */
export const ApiProviders = {
  RECALL: 'recall',
  DEEPGRAM: 'deepgram',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
  CLERK: 'clerk',
  STRIPE: 'stripe',
  HUBSPOT: 'hubspot',
  SLACK: 'slack',
  SENDGRID: 'sendgrid',
  TWILIO: 'twilio',
} as const;

export type ApiProvider = (typeof ApiProviders)[keyof typeof ApiProviders];

/**
 * Environments for API keys
 */
export const Environments = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  TEST: 'test',
} as const;

export type Environment = (typeof Environments)[keyof typeof Environments];

export interface CreateSystemApiKeyInput {
  name: string;
  provider: string;
  environment?: string;
  key: string; // Plain text key (will be encrypted)
  expiresAt?: Date;
  rotationDays?: number; // Days until rotation is due
}

export interface UpdateSystemApiKeyInput {
  name?: string;
  key?: string; // New key (will be encrypted)
  isActive?: boolean;
  expiresAt?: Date | null;
  rotationDays?: number | null;
}

export interface SystemApiKeyInfo {
  id: string;
  name: string;
  provider: string;
  environment: string;
  keyHint: string;
  isActive: boolean;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  rotationDue: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class SystemApiKeyService {
  /**
   * List all API keys (without decrypted values)
   */
  async listKeys(
    options: { page?: number; limit?: number },
    filter?: SystemApiKeyFilter
  ): Promise<PaginatedResult<SystemApiKeyInfo>> {
    const result = await systemApiKeyRepository.findManyPaginated(options, filter);

    return {
      ...result,
      data: result.data.map(this.toKeyInfo),
    };
  }

  /**
   * Get a single API key info
   */
  async getKey(id: string): Promise<SystemApiKeyInfo | null> {
    const key = await systemApiKeyRepository.findById(id);
    return key ? this.toKeyInfo(key) : null;
  }

  /**
   * Get decrypted key value (for runtime use)
   */
  async getDecryptedKey(provider: string, environment: string = 'production'): Promise<string | null> {
    const key = await systemApiKeyRepository.getActiveKey(provider, environment);
    if (!key) return null;

    try {
      const decrypted = encryptionService.decrypt(key.encryptedKey);
      // Record usage
      await systemApiKeyRepository.recordUsage(key.id);
      return decrypted;
    } catch (error) {
      throw new AppError('Failed to decrypt API key', 500, 'DECRYPTION_FAILED');
    }
  }

  /**
   * Create a new API key
   */
  async createKey(
    input: CreateSystemApiKeyInput,
    adminId: string,
    context: AuditContext
  ): Promise<SystemApiKeyInfo> {
    // Check for duplicate provider + environment
    const existing = await systemApiKeyRepository.findByProviderEnv(
      input.provider,
      input.environment || 'production'
    );
    if (existing) {
      throw new AppError(
        `API key for ${input.provider} in ${input.environment || 'production'} already exists`,
        409,
        'DUPLICATE_KEY'
      );
    }

    // Encrypt the key
    const encryptedKey = encryptionService.encrypt(input.key);
    const keyHint = encryptionService.getHint(input.key);

    // Calculate rotation due date
    let rotationDue: Date | null = null;
    if (input.rotationDays) {
      rotationDue = new Date();
      rotationDue.setDate(rotationDue.getDate() + input.rotationDays);
    }

    const created = await systemApiKeyRepository.create({
      name: input.name,
      provider: input.provider,
      environment: input.environment || 'production',
      encryptedKey,
      keyHint,
      expiresAt: input.expiresAt,
      rotationDue,
      createdBy: adminId,
    });

    // Audit log
    await auditService.log(context, {
      action: AuditActions.SYSTEM_API_KEY_CREATED,
      entityType: 'system_api_key',
      entityId: created.id,
      details: {
        name: input.name,
        provider: input.provider,
        environment: input.environment || 'production',
      },
    });

    return this.toKeyInfo(created);
  }

  /**
   * Update an API key
   */
  async updateKey(
    id: string,
    input: UpdateSystemApiKeyInput,
    context: AuditContext
  ): Promise<SystemApiKeyInfo> {
    const existing = await systemApiKeyRepository.findById(id);
    if (!existing) {
      throw new AppError('API key not found', 404, 'KEY_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    const previousData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      previousData.name = existing.name;
      updateData.name = input.name;
    }

    if (input.isActive !== undefined) {
      previousData.isActive = existing.isActive;
      updateData.isActive = input.isActive;
    }

    if (input.expiresAt !== undefined) {
      previousData.expiresAt = existing.expiresAt;
      updateData.expiresAt = input.expiresAt;
    }

    if (input.key !== undefined) {
      // Rotate key - encrypt new value
      updateData.encryptedKey = encryptionService.encrypt(input.key);
      updateData.keyHint = encryptionService.getHint(input.key);
      updateData.rotatedAt = new Date();
    }

    if (input.rotationDays !== undefined) {
      if (input.rotationDays === null) {
        updateData.rotationDue = null;
      } else {
        const rotationDue = new Date();
        rotationDue.setDate(rotationDue.getDate() + input.rotationDays);
        updateData.rotationDue = rotationDue;
      }
    }

    const updated = await systemApiKeyRepository.update(id, updateData);

    // Audit log
    await auditService.log(context, {
      action: input.key
        ? AuditActions.SYSTEM_API_KEY_ROTATED
        : AuditActions.SYSTEM_API_KEY_UPDATED,
      entityType: 'system_api_key',
      entityId: id,
      previousData,
      newData: {
        name: updated.name,
        isActive: updated.isActive,
        expiresAt: updated.expiresAt,
        rotatedAt: updated.rotatedAt,
      },
      details: input.key ? { rotated: true } : undefined,
    });

    return this.toKeyInfo(updated);
  }

  /**
   * Rotate an API key with a new value
   */
  async rotateKey(
    id: string,
    newKey: string,
    context: AuditContext
  ): Promise<SystemApiKeyInfo> {
    return this.updateKey(id, { key: newKey }, context);
  }

  /**
   * Deactivate an API key
   */
  async deactivateKey(id: string, context: AuditContext): Promise<SystemApiKeyInfo> {
    const existing = await systemApiKeyRepository.findById(id);
    if (!existing) {
      throw new AppError('API key not found', 404, 'KEY_NOT_FOUND');
    }

    const updated = await systemApiKeyRepository.deactivate(id);

    await auditService.log(context, {
      action: AuditActions.SYSTEM_API_KEY_UPDATED,
      entityType: 'system_api_key',
      entityId: id,
      previousData: { isActive: true },
      newData: { isActive: false },
      details: { deactivated: true },
    });

    return this.toKeyInfo(updated);
  }

  /**
   * Delete an API key permanently
   */
  async deleteKey(id: string, context: AuditContext): Promise<void> {
    const existing = await systemApiKeyRepository.findById(id);
    if (!existing) {
      throw new AppError('API key not found', 404, 'KEY_NOT_FOUND');
    }

    await systemApiKeyRepository.delete(id);

    await auditService.log(context, {
      action: AuditActions.SYSTEM_API_KEY_DELETED,
      entityType: 'system_api_key',
      entityId: id,
      previousData: {
        name: existing.name,
        provider: existing.provider,
        environment: existing.environment,
      },
    });
  }

  /**
   * Get keys due for rotation
   */
  async getKeysDueForRotation(): Promise<SystemApiKeyInfo[]> {
    const keys = await systemApiKeyRepository.findDueForRotation();
    return keys.map(this.toKeyInfo);
  }

  /**
   * Get expired keys
   */
  async getExpiredKeys(): Promise<SystemApiKeyInfo[]> {
    const keys = await systemApiKeyRepository.findExpired();
    return keys.map(this.toKeyInfo);
  }

  /**
   * Verify a key can be decrypted (health check)
   */
  async verifyKey(id: string): Promise<{ valid: boolean; error?: string }> {
    const key = await systemApiKeyRepository.findById(id);
    if (!key) {
      return { valid: false, error: 'Key not found' };
    }

    try {
      encryptionService.decrypt(key.encryptedKey);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Decryption failed' };
    }
  }

  /**
   * Get key statistics
   */
  async getKeyStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    dueForRotation: number;
    byProvider: Record<string, number>;
  }> {
    const allKeys = await systemApiKeyRepository.findMany();
    const now = new Date();

    const stats = {
      total: allKeys.length,
      active: 0,
      expired: 0,
      dueForRotation: 0,
      byProvider: {} as Record<string, number>,
    };

    for (const key of allKeys) {
      // Count by provider
      stats.byProvider[key.provider] = (stats.byProvider[key.provider] || 0) + 1;

      // Active count
      if (key.isActive) {
        stats.active++;
      }

      // Expired count
      if (key.expiresAt && key.expiresAt < now) {
        stats.expired++;
      }

      // Rotation due count
      if (key.rotationDue && key.rotationDue <= now) {
        stats.dueForRotation++;
      }
    }

    return stats;
  }

  /**
   * Convert database model to info DTO (no encrypted data)
   */
  private toKeyInfo(key: SystemApiKey): SystemApiKeyInfo {
    return {
      id: key.id,
      name: key.name,
      provider: key.provider,
      environment: key.environment,
      keyHint: key.keyHint,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      rotatedAt: key.rotatedAt,
      rotationDue: key.rotationDue,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      createdBy: key.createdBy,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }
}

export const systemApiKeyService = new SystemApiKeyService();
