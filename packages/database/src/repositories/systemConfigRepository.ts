/**
 * System config repository
 * Handles CRUD for system-wide configuration settings
 */

import type { SystemConfig, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateSystemConfigInput,
  UpdateSystemConfigInput,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

export interface SystemConfigFilter {
  category?: string | string[];
  encrypted?: boolean;
  search?: string;
}

export class SystemConfigRepository {
  /**
   * Find config by ID
   */
  async findById(id: string): Promise<SystemConfig | null> {
    return prisma.systemConfig.findUnique({
      where: { id },
    });
  }

  /**
   * Find config by key
   */
  async findByKey(key: string): Promise<SystemConfig | null> {
    return prisma.systemConfig.findUnique({
      where: { key },
    });
  }

  /**
   * Find all configs with optional filters
   */
  async findMany(
    filter?: SystemConfigFilter,
    orderBy?: Prisma.SystemConfigOrderByWithRelationInput
  ): Promise<SystemConfig[]> {
    const where = this.buildWhereClause(filter);
    return prisma.systemConfig.findMany({
      where,
      orderBy: orderBy || { key: 'asc' },
    });
  }

  /**
   * Find configs with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: SystemConfigFilter,
    orderBy?: Prisma.SystemConfigOrderByWithRelationInput
  ): Promise<PaginatedResult<SystemConfig>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        orderBy: orderBy || { key: 'asc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.systemConfig.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Create new config
   */
  async create(data: CreateSystemConfigInput): Promise<SystemConfig> {
    return prisma.systemConfig.create({
      data: {
        key: data.key,
        value: data.value,
        encrypted: data.encrypted ?? false,
        category: data.category || 'general',
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Update config
   */
  async update(id: string, data: UpdateSystemConfigInput): Promise<SystemConfig> {
    const updateData: Prisma.SystemConfigUpdateInput = {};

    if (data.value !== undefined) updateData.value = data.value;
    if (data.encrypted !== undefined) updateData.encrypted = data.encrypted;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

    return prisma.systemConfig.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update config by key (upsert)
   */
  async upsertByKey(
    key: string,
    data: Omit<CreateSystemConfigInput, 'key'>
  ): Promise<SystemConfig> {
    return prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: data.value,
        encrypted: data.encrypted ?? false,
        category: data.category || 'general',
        updatedBy: data.updatedBy,
      },
      update: {
        value: data.value,
        encrypted: data.encrypted,
        category: data.category,
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Delete config
   */
  async delete(id: string): Promise<void> {
    await prisma.systemConfig.delete({
      where: { id },
    });
  }

  /**
   * Delete config by key
   */
  async deleteByKey(key: string): Promise<void> {
    await prisma.systemConfig.delete({
      where: { key },
    });
  }

  /**
   * Get config value by key (convenience method)
   */
  async getValue<T = unknown>(key: string): Promise<T | null> {
    const config = await this.findByKey(key);
    return config ? (config.value as T) : null;
  }

  /**
   * Set config value by key (convenience method)
   */
  async setValue(
    key: string,
    value: Prisma.InputJsonValue,
    updatedBy?: string
  ): Promise<SystemConfig> {
    return this.upsertByKey(key, { value, updatedBy });
  }

  /**
   * Get configs by category
   */
  async findByCategory(category: string): Promise<SystemConfig[]> {
    return prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Get all configs as a key-value map
   */
  async getAll(): Promise<Record<string, unknown>> {
    const configs = await prisma.systemConfig.findMany();
    return configs.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  /**
   * Get configs by prefix (e.g., "email.", "rate_limit.")
   */
  async findByPrefix(prefix: string): Promise<SystemConfig[]> {
    return prisma.systemConfig.findMany({
      where: {
        key: { startsWith: prefix },
      },
      orderBy: { key: 'asc' },
    });
  }

  private buildWhereClause(filter?: SystemConfigFilter): Prisma.SystemConfigWhereInput {
    if (!filter) return {};

    const where: Prisma.SystemConfigWhereInput = {};

    if (filter.category) {
      where.category = Array.isArray(filter.category)
        ? { in: filter.category }
        : filter.category;
    }

    if (filter.encrypted !== undefined) {
      where.encrypted = filter.encrypted;
    }

    if (filter.search) {
      where.OR = [{ key: { contains: filter.search, mode: 'insensitive' } }];
    }

    return where;
  }
}

export const systemConfigRepository = new SystemConfigRepository();
