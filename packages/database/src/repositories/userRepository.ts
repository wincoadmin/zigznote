/**
 * User repository for data access
 */

import type { User, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateUserInput,
  UpdateUserInput,
  UserFilterOptions,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Include options for user queries
 */
export interface UserInclude {
  organization?: boolean;
  calendarConnections?: boolean;
  meetingsCreated?: boolean;
}

/**
 * Repository for User entity operations
 */
export class UserRepository {
  /**
   * Finds a user by ID
   * @param id - User ID
   * @param include - Relations to include
   * @param includeDeleted - Include soft-deleted records
   */
  async findById(
    id: string,
    include?: UserInclude,
    includeDeleted = false
  ): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include,
    });
  }

  /**
   * Finds a user by Clerk ID
   * @param clerkId - Clerk user ID
   * @param include - Relations to include
   */
  async findByClerkId(
    clerkId: string,
    include?: UserInclude
  ): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        clerkId,
        deletedAt: null,
      },
      include,
    });
  }

  /**
   * Finds a user by email
   * @param email - User email
   * @param include - Relations to include
   */
  async findByEmail(
    email: string,
    include?: UserInclude
  ): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include,
    });
  }

  /**
   * Finds all users matching the filter
   * @param filter - Filter options
   * @param include - Relations to include
   */
  async findMany(
    filter?: UserFilterOptions,
    include?: UserInclude
  ): Promise<User[]> {
    const where = this.buildWhereClause(filter);
    return prisma.user.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds users by organization with pagination
   * @param organizationId - Organization ID
   * @param options - Pagination options
   * @param include - Relations to include
   */
  async findByOrganization(
    organizationId: string,
    options: PaginationOptions,
    include?: UserInclude
  ): Promise<PaginatedResult<User>> {
    return this.findManyPaginated(options, { organizationId }, include);
  }

  /**
   * Finds users with pagination
   * @param options - Pagination options
   * @param filter - Filter options
   * @param include - Relations to include
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: UserFilterOptions,
    include?: UserInclude
  ): Promise<PaginatedResult<User>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Counts users matching the filter
   * @param filter - Filter options
   */
  async count(filter?: UserFilterOptions): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.user.count({ where });
  }

  /**
   * Creates a new user
   * @param data - User data
   * @param include - Relations to include in returned record
   */
  async create(data: CreateUserInput, include?: UserInclude): Promise<User> {
    return prisma.user.create({
      data: {
        organizationId: data.organizationId,
        email: data.email,
        name: data.name,
        clerkId: data.clerkId,
        role: data.role ?? 'member',
        avatarUrl: data.avatarUrl,
      },
      include,
    });
  }

  /**
   * Updates a user by ID
   * @param id - User ID
   * @param data - Update data
   * @param include - Relations to include in returned record
   */
  async update(
    id: string,
    data: UpdateUserInput,
    include?: UserInclude
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
      include,
    });
  }

  /**
   * Updates a user by Clerk ID
   * @param clerkId - Clerk user ID
   * @param data - Update data
   * @param include - Relations to include in returned record
   */
  async updateByClerkId(
    clerkId: string,
    data: UpdateUserInput,
    include?: UserInclude
  ): Promise<User> {
    return prisma.user.update({
      where: { clerkId },
      data,
      include,
    });
  }

  /**
   * Soft deletes a user
   * @param id - User ID
   */
  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard deletes a user (permanent)
   * @param id - User ID
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Restores a soft-deleted user
   * @param id - User ID
   */
  async restore(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Checks if a user exists with the given email
   * @param email - Email to check
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email, deletedAt: null },
    });
    return count > 0;
  }

  /**
   * Gets users by role within an organization
   * @param organizationId - Organization ID
   * @param role - Role to filter by
   */
  async findByRole(
    organizationId: string,
    role: string,
    include?: UserInclude
  ): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        organizationId,
        role,
        deletedAt: null,
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Builds Prisma where clause from filter options
   */
  private buildWhereClause(filter?: UserFilterOptions): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (!filter?.includeDeleted) {
      where.deletedAt = null;
    }

    if (filter?.organizationId) {
      where.organizationId = filter.organizationId;
    }

    if (filter?.role) {
      where.role = filter.role;
    }

    if (filter?.email) {
      where.email = filter.email;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
