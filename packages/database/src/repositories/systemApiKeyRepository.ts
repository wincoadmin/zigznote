/**
 * System API key repository
 * Handles CRUD for encrypted third-party API keys
 */

import type { SystemApiKey, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateSystemApiKeyInput,
  UpdateSystemApiKeyInput,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

export interface SystemApiKeyFilter {
  provider?: string | string[];
  environment?: string | string[];
  isActive?: boolean;
  search?: string;
}

export class SystemApiKeyRepository {
  /**
   * Find API key by ID
   */
  async findById(id: string): Promise<SystemApiKey | null> {
    return prisma.systemApiKey.findUnique({
      where: { id },
    });
  }

  /**
   * Find API key by provider and environment
   */
  async findByProviderEnv(
    provider: string,
    environment: string = 'production'
  ): Promise<SystemApiKey | null> {
    return prisma.systemApiKey.findUnique({
      where: {
        provider_environment: { provider, environment },
      },
    });
  }

  /**
   * Find all API keys with optional filters
   */
  async findMany(
    filter?: SystemApiKeyFilter,
    orderBy?: Prisma.SystemApiKeyOrderByWithRelationInput
  ): Promise<SystemApiKey[]> {
    const where = this.buildWhereClause(filter);
    return prisma.systemApiKey.findMany({
      where,
      orderBy: orderBy || { provider: 'asc' },
    });
  }

  /**
   * Find API keys with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: SystemApiKeyFilter,
    orderBy?: Prisma.SystemApiKeyOrderByWithRelationInput
  ): Promise<PaginatedResult<SystemApiKey>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.systemApiKey.findMany({
        where,
        orderBy: orderBy || { provider: 'asc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.systemApiKey.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Create new API key
   */
  async create(data: CreateSystemApiKeyInput): Promise<SystemApiKey> {
    return prisma.systemApiKey.create({
      data: {
        name: data.name,
        provider: data.provider,
        environment: data.environment || 'production',
        encryptedKey: data.encryptedKey,
        keyHint: data.keyHint,
        expiresAt: data.expiresAt,
        rotationDue: data.rotationDue,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Update API key
   */
  async update(id: string, data: UpdateSystemApiKeyInput): Promise<SystemApiKey> {
    const updateData: Prisma.SystemApiKeyUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.encryptedKey !== undefined) updateData.encryptedKey = data.encryptedKey;
    if (data.keyHint !== undefined) updateData.keyHint = data.keyHint;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
    if (data.rotatedAt !== undefined) updateData.rotatedAt = data.rotatedAt;
    if (data.rotationDue !== undefined) updateData.rotationDue = data.rotationDue;
    if (data.lastUsedAt !== undefined) updateData.lastUsedAt = data.lastUsedAt;
    if (data.usageCount !== undefined) updateData.usageCount = data.usageCount;

    return prisma.systemApiKey.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete API key
   */
  async delete(id: string): Promise<void> {
    await prisma.systemApiKey.delete({
      where: { id },
    });
  }

  /**
   * Record API key usage
   */
  async recordUsage(id: string): Promise<void> {
    await prisma.systemApiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Get active key for a provider (for runtime use)
   */
  async getActiveKey(
    provider: string,
    environment: string = 'production'
  ): Promise<SystemApiKey | null> {
    return prisma.systemApiKey.findFirst({
      where: {
        provider,
        environment,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  }

  /**
   * Get keys due for rotation
   */
  async findDueForRotation(): Promise<SystemApiKey[]> {
    return prisma.systemApiKey.findMany({
      where: {
        isActive: true,
        rotationDue: { lte: new Date() },
      },
      orderBy: { rotationDue: 'asc' },
    });
  }

  /**
   * Get expired keys
   */
  async findExpired(): Promise<SystemApiKey[]> {
    return prisma.systemApiKey.findMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
    });
  }

  /**
   * Deactivate key
   */
  async deactivate(id: string): Promise<SystemApiKey> {
    return prisma.systemApiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private buildWhereClause(filter?: SystemApiKeyFilter): Prisma.SystemApiKeyWhereInput {
    if (!filter) return {};

    const where: Prisma.SystemApiKeyWhereInput = {};

    if (filter.provider) {
      where.provider = Array.isArray(filter.provider)
        ? { in: filter.provider }
        : filter.provider;
    }

    if (filter.environment) {
      where.environment = Array.isArray(filter.environment)
        ? { in: filter.environment }
        : filter.environment;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { provider: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}

export const systemApiKeyRepository = new SystemApiKeyRepository();
