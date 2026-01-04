/**
 * Organization repository for data access
 */

import type { Organization, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Include options for organization queries
 */
export interface OrganizationInclude {
  users?: boolean;
  meetings?: boolean;
  integrationConnections?: boolean;
  automationRules?: boolean;
  webhooks?: boolean;
}

/**
 * Filter options for organization queries
 */
export interface OrganizationFilter {
  plan?: string;
  search?: string;
  includeDeleted?: boolean;
}

/**
 * Repository for Organization entity operations
 */
export class OrganizationRepository {
  /**
   * Finds an organization by ID
   * @param id - Organization ID
   * @param include - Relations to include
   * @param includeDeleted - Include soft-deleted records
   */
  async findById(
    id: string,
    include?: OrganizationInclude,
    includeDeleted = false
  ): Promise<Organization | null> {
    return prisma.organization.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include,
    });
  }

  /**
   * Finds an organization by name
   * @param name - Organization name
   * @param includeDeleted - Include soft-deleted records
   */
  async findByName(
    name: string,
    includeDeleted = false
  ): Promise<Organization | null> {
    return prisma.organization.findFirst({
      where: {
        name,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  /**
   * Finds all organizations matching the filter
   * @param filter - Filter options
   * @param include - Relations to include
   */
  async findMany(
    filter?: OrganizationFilter,
    include?: OrganizationInclude
  ): Promise<Organization[]> {
    const where = this.buildWhereClause(filter);
    return prisma.organization.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds organizations with pagination
   * @param options - Pagination options
   * @param filter - Filter options
   * @param include - Relations to include
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: OrganizationFilter,
    include?: OrganizationInclude
  ): Promise<PaginatedResult<Organization>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Counts organizations matching the filter
   * @param filter - Filter options
   */
  async count(filter?: OrganizationFilter): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.organization.count({ where });
  }

  /**
   * Creates a new organization
   * @param data - Organization data
   * @param include - Relations to include in returned record
   */
  async create(
    data: CreateOrganizationInput,
    include?: OrganizationInclude
  ): Promise<Organization> {
    return prisma.organization.create({
      data: {
        name: data.name,
        plan: data.plan ?? 'free',
        settings: data.settings ?? {},
      },
      include,
    });
  }

  /**
   * Updates an organization by ID
   * @param id - Organization ID
   * @param data - Update data
   * @param include - Relations to include in returned record
   */
  async update(
    id: string,
    data: UpdateOrganizationInput,
    include?: OrganizationInclude
  ): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Soft deletes an organization
   * @param id - Organization ID
   */
  async softDelete(id: string): Promise<void> {
    await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard deletes an organization (permanent)
   * @param id - Organization ID
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Restores a soft-deleted organization
   * @param id - Organization ID
   */
  async restore(id: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Updates organization settings (merges with existing)
   * @param id - Organization ID
   * @param settings - Settings to merge
   */
  async updateSettings(
    id: string,
    settings: Record<string, unknown>
  ): Promise<Organization> {
    const org = await this.findById(id);
    if (!org) {
      throw new Error(`Organization not found: ${id}`);
    }

    const existingSettings =
      typeof org.settings === 'object' && org.settings !== null
        ? (org.settings as Record<string, unknown>)
        : {};

    return prisma.organization.update({
      where: { id },
      data: {
        settings: { ...existingSettings, ...settings } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Builds Prisma where clause from filter options
   */
  private buildWhereClause(
    filter?: OrganizationFilter
  ): Prisma.OrganizationWhereInput {
    const where: Prisma.OrganizationWhereInput = {};

    if (!filter?.includeDeleted) {
      where.deletedAt = null;
    }

    if (filter?.plan) {
      where.plan = filter.plan;
    }

    if (filter?.search) {
      where.name = { contains: filter.search, mode: 'insensitive' };
    }

    return where;
  }
}

// Export singleton instance
export const organizationRepository = new OrganizationRepository();
