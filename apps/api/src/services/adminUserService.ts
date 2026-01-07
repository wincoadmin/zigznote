/**
 * Admin user management service
 * Handles user CRUD and impersonation for admin panel
 */

import { userRepository, prisma } from '@zigznote/database';
import type { User } from '@zigznote/database';
import type { PaginatedResult, UserFilterOptions } from '@zigznote/database';
import { auditService, AuditActions, type AuditContext } from './auditService';
import { AppError } from '../utils/errors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 12;

export interface AdminUserFilter extends UserFilterOptions {
  organizationId?: string;
  role?: string;
  search?: string;
  includeDeleted?: boolean;
}

export interface UserDetails {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
  clerkId: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    plan: string;
  };
  meetingCount?: number;
  lastActiveAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateUserInput {
  name?: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  organizationId: string;
  role?: string;
  password?: string; // If not provided, generates a temporary one
}

export interface ImpersonationToken {
  token: string;
  userId: string;
  adminId: string;
  expiresAt: Date;
}

// In-memory store for impersonation tokens (should be Redis in production)
const impersonationTokens = new Map<string, ImpersonationToken>();

class AdminUserService {
  /**
   * List users with pagination and filters
   */
  async listUsers(
    options: { page?: number; limit?: number },
    filter?: AdminUserFilter
  ): Promise<PaginatedResult<UserDetails>> {
    const result = await userRepository.findManyPaginated(
      options,
      {
        organizationId: filter?.organizationId,
        role: filter?.role,
        search: filter?.search,
        includeDeleted: filter?.includeDeleted,
      },
      { organization: true }
    );

    return {
      ...result,
      data: result.data.map((user) => this.toUserDetails(user)),
    };
  }

  /**
   * Create a new user
   */
  async createUser(
    input: CreateUserInput,
    context: AuditContext
  ): Promise<{ user: UserDetails; temporaryPassword?: string }> {
    // Check if email is already in use
    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('Email already in use', 400, 'EMAIL_EXISTS');
    }

    // Generate temporary password if not provided
    const temporaryPassword = input.password || crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);

    // Create user with Prisma directly to include password
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        organizationId: input.organizationId,
        role: input.role || 'member',
        password: passwordHash,
        emailVerified: new Date(), // Mark as verified since admin created
      },
      include: {
        organization: true,
      },
    });

    await auditService.log(context, {
      action: AuditActions.USER_CREATED,
      entityType: 'user',
      entityId: user.id,
      newData: {
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
      },
    });

    return {
      user: this.toUserDetails(user),
      temporaryPassword: input.password ? undefined : temporaryPassword,
    };
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: string, includeDeleted = false): Promise<UserDetails | null> {
    const user = await userRepository.findById(id, { organization: true }, includeDeleted);
    return user ? this.toUserDetails(user) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserDetails | null> {
    const user = await userRepository.findByEmail(email, { organization: true });
    return user ? this.toUserDetails(user) : null;
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    input: UpdateUserInput,
    context: AuditContext
  ): Promise<UserDetails> {
    const existing = await userRepository.findById(id, { organization: true });
    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const previousData: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      previousData.name = existing.name;
      updateData.name = input.name;
    }

    if (input.role !== undefined) {
      previousData.role = existing.role;
      updateData.role = input.role;
    }

    if (input.avatarUrl !== undefined) {
      previousData.avatarUrl = existing.avatarUrl;
      updateData.avatarUrl = input.avatarUrl;
    }

    const updated = await userRepository.update(id, updateData, { organization: true });

    await auditService.log(context, {
      action: AuditActions.USER_UPDATED,
      entityType: 'user',
      entityId: id,
      previousData,
      newData: updateData,
    });

    return this.toUserDetails(updated);
  }

  /**
   * Suspend user (soft delete)
   */
  async suspendUser(id: string, context: AuditContext): Promise<void> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.deletedAt) {
      throw new AppError('User is already suspended', 400, 'ALREADY_SUSPENDED');
    }

    await userRepository.softDelete(id);

    await auditService.log(context, {
      action: AuditActions.USER_DELETED,
      entityType: 'user',
      entityId: id,
      details: { suspended: true },
      previousData: { deletedAt: null },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  /**
   * Restore suspended user
   */
  async restoreUser(id: string, context: AuditContext): Promise<UserDetails> {
    const user = await userRepository.findById(id, { organization: true }, true);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.deletedAt) {
      throw new AppError('User is not suspended', 400, 'NOT_SUSPENDED');
    }

    await userRepository.restore(id);

    await auditService.log(context, {
      action: AuditActions.USER_UPDATED,
      entityType: 'user',
      entityId: id,
      details: { restored: true },
      previousData: { deletedAt: user.deletedAt.toISOString() },
      newData: { deletedAt: null },
    });

    // Fetch with organization
    const withOrg = await userRepository.findById(id, { organization: true });
    return this.toUserDetails(withOrg!);
  }

  /**
   * Permanently delete user
   */
  async deleteUserPermanently(id: string, context: AuditContext): Promise<void> {
    const user = await userRepository.findById(id, undefined, true);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await userRepository.hardDelete(id);

    await auditService.log(context, {
      action: AuditActions.USER_DELETED,
      entityType: 'user',
      entityId: id,
      details: { permanent: true },
      previousData: {
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
      },
    });
  }

  /**
   * Create impersonation token for user
   */
  async impersonateUser(
    userId: string,
    adminId: string,
    context: AuditContext
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.deletedAt) {
      throw new AppError('Cannot impersonate suspended user', 400, 'USER_SUSPENDED');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store token
    impersonationTokens.set(token, {
      token,
      userId,
      adminId,
      expiresAt,
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    await auditService.log(context, {
      action: AuditActions.USER_IMPERSONATED,
      entityType: 'user',
      entityId: userId,
      details: {
        expiresAt: expiresAt.toISOString(),
        userEmail: user.email,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validate impersonation token
   */
  validateImpersonationToken(token: string): ImpersonationToken | null {
    const tokenData = impersonationTokens.get(token);
    if (!tokenData) return null;

    if (tokenData.expiresAt < new Date()) {
      impersonationTokens.delete(token);
      return null;
    }

    return tokenData;
  }

  /**
   * End impersonation session
   */
  endImpersonation(token: string): void {
    impersonationTokens.delete(token);
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    suspended: number;
    byRole: Record<string, number>;
    recentSignups: number;
  }> {
    const [allUsers, _recentUsers] = await Promise.all([
      userRepository.findMany({ includeDeleted: true }),
      userRepository.findMany({
        // Users from the last 30 days
      }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = {
      total: allUsers.length,
      active: 0,
      suspended: 0,
      byRole: {} as Record<string, number>,
      recentSignups: 0,
    };

    for (const user of allUsers) {
      if (user.deletedAt) {
        stats.suspended++;
      } else {
        stats.active++;
      }

      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      if (user.createdAt >= thirtyDaysAgo) {
        stats.recentSignups++;
      }
    }

    return stats;
  }

  /**
   * Search users
   */
  async searchUsers(
    query: string,
    limit = 20
  ): Promise<UserDetails[]> {
    const result = await userRepository.findManyPaginated(
      { page: 1, limit },
      { search: query },
      { organization: true }
    );

    return result.data.map((user) => this.toUserDetails(user));
  }

  /**
   * Clean up expired impersonation tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of impersonationTokens) {
      if (data.expiresAt < now) {
        impersonationTokens.delete(token);
      }
    }
  }

  /**
   * Convert user to details DTO
   */
  private toUserDetails(user: User & { organization?: { id: string; name: string; plan: string } | null }): UserDetails {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      clerkId: user.clerkId ?? '',
      organizationId: user.organizationId,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            plan: user.organization.plan,
          }
        : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}

export const adminUserService = new AdminUserService();
