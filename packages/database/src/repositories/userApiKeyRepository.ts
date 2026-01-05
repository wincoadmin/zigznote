/**
 * @ownership
 * @domain User API Key Data Access
 * @description Database operations for user API keys
 * @single-responsibility YES — all UserApiKey database operations
 */

import type { UserApiKey } from '@prisma/client';
import { prisma } from '../client';
import type { CreateUserApiKeyInput, UpdateUserApiKeyInput } from '../types';

export class UserApiKeyRepository {
  /**
   * Create a new API key
   */
  async create(data: CreateUserApiKeyInput): Promise<UserApiKey> {
    return prisma.userApiKey.create({ data });
  }

  /**
   * Find API key by ID
   */
  async findById(id: string): Promise<UserApiKey | null> {
    return prisma.userApiKey.findUnique({ where: { id } });
  }

  /**
   * Find all active API keys for a user
   */
  async findByUser(userId: string): Promise<UserApiKey[]> {
    return prisma.userApiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find API keys by prefix (for validation)
   */
  async findByPrefix(keyPrefix: string): Promise<UserApiKey[]> {
    return prisma.userApiKey.findMany({
      where: { keyPrefix },
    });
  }

  /**
   * Count active API keys for a user
   */
  async countByUser(userId: string): Promise<number> {
    return prisma.userApiKey.count({
      where: { userId, revokedAt: null },
    });
  }

  /**
   * Record API key usage
   */
  async recordUsage(id: string, ip?: string): Promise<void> {
    await prisma.userApiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ip,
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Revoke an API key
   */
  async revoke(id: string): Promise<void> {
    await prisma.userApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Update API key name or scopes
   */
  async update(id: string, data: UpdateUserApiKeyInput): Promise<UserApiKey> {
    return prisma.userApiKey.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete expired and revoked API keys (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.userApiKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: { not: null },
      },
    });
    return result.count;
  }
}

export const userApiKeyRepository = new UserApiKeyRepository();
