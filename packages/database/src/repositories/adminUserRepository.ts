/**
 * Admin user repository
 * Handles CRUD operations for admin panel users
 */

import type { AdminUser, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

export type AdminUserInclude = Prisma.AdminUserInclude;

export interface AdminUserFilter {
  email?: string;
  role?: string | string[];
  isActive?: boolean;
  search?: string;
}

export class AdminUserRepository {
  /**
   * Find admin user by ID
   */
  async findById(
    id: string,
    include?: AdminUserInclude
  ): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Find admin user by email
   */
  async findByEmail(
    email: string,
    include?: AdminUserInclude
  ): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
      include,
    });
  }

  /**
   * Find all admin users with optional filters
   */
  async findMany(
    filter?: AdminUserFilter,
    orderBy?: Prisma.AdminUserOrderByWithRelationInput,
    include?: AdminUserInclude
  ): Promise<AdminUser[]> {
    const where = this.buildWhereClause(filter);
    return prisma.adminUser.findMany({
      where,
      orderBy: orderBy || { createdAt: 'desc' },
      include,
    });
  }

  /**
   * Find admin users with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: AdminUserFilter,
    orderBy?: Prisma.AdminUserOrderByWithRelationInput,
    include?: AdminUserInclude
  ): Promise<PaginatedResult<AdminUser>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        include,
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.adminUser.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Count admin users matching filter
   */
  async count(filter?: AdminUserFilter): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.adminUser.count({ where });
  }

  /**
   * Create new admin user
   */
  async create(
    data: CreateAdminUserInput,
    include?: AdminUserInclude
  ): Promise<AdminUser> {
    return prisma.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role || 'support',
        createdBy: data.createdBy,
        backupCodes: [],
      },
      include,
    });
  }

  /**
   * Update admin user
   */
  async update(
    id: string,
    data: UpdateAdminUserInput,
    include?: AdminUserInclude
  ): Promise<AdminUser> {
    const updateData: Prisma.AdminUserUpdateInput = {};

    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.twoFactorSecret !== undefined) updateData.twoFactorSecret = data.twoFactorSecret;
    if (data.twoFactorEnabled !== undefined) updateData.twoFactorEnabled = data.twoFactorEnabled;
    if (data.backupCodes !== undefined) updateData.backupCodes = data.backupCodes;
    if (data.failedLoginAttempts !== undefined) updateData.failedLoginAttempts = data.failedLoginAttempts;
    if (data.lockedUntil !== undefined) updateData.lockedUntil = data.lockedUntil;
    if (data.lastLoginAt !== undefined) updateData.lastLoginAt = data.lastLoginAt;
    if (data.lastLoginIp !== undefined) updateData.lastLoginIp = data.lastLoginIp;
    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
    if (data.passwordChangedAt !== undefined) updateData.passwordChangedAt = data.passwordChangedAt;

    return prisma.adminUser.update({
      where: { id },
      data: updateData,
      include,
    });
  }

  /**
   * Delete admin user (hard delete)
   */
  async delete(id: string): Promise<void> {
    await prisma.adminUser.delete({
      where: { id },
    });
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedAttempts(
    id: string,
    lockUntil?: Date
  ): Promise<AdminUser> {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: lockUntil,
      },
    });
  }

  /**
   * Reset failed login attempts and record successful login
   */
  async recordSuccessfulLogin(
    id: string,
    ipAddress: string
  ): Promise<AdminUser> {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });
  }

  /**
   * Check if any admin users exist (for initial setup)
   */
  async hasAnyAdmins(): Promise<boolean> {
    const count = await prisma.adminUser.count();
    return count > 0;
  }

  /**
   * Get admin users by role
   */
  async findByRole(role: string): Promise<AdminUser[]> {
    return prisma.adminUser.findMany({
      where: { role, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  private buildWhereClause(filter?: AdminUserFilter): Prisma.AdminUserWhereInput {
    if (!filter) return {};

    const where: Prisma.AdminUserWhereInput = {};

    if (filter.email) {
      where.email = { contains: filter.email.toLowerCase(), mode: 'insensitive' };
    }

    if (filter.role) {
      where.role = Array.isArray(filter.role) ? { in: filter.role } : filter.role;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search.toLowerCase(), mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}

export const adminUserRepository = new AdminUserRepository();
