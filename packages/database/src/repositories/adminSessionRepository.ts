/**
 * Admin session repository
 * Handles admin session management for authentication
 */

import type { AdminSession, Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { CreateAdminSessionInput } from '../types';

export type AdminSessionInclude = Prisma.AdminSessionInclude;

export class AdminSessionRepository {
  /**
   * Find session by ID
   */
  async findById(
    id: string,
    include?: AdminSessionInclude
  ): Promise<AdminSession | null> {
    return prisma.adminSession.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Find session by token
   */
  async findByToken(
    token: string,
    include?: AdminSessionInclude
  ): Promise<AdminSession | null> {
    return prisma.adminSession.findUnique({
      where: { token },
      include,
    });
  }

  /**
   * Find active sessions for an admin user
   */
  async findActiveByUserId(
    adminUserId: string,
    include?: AdminSessionInclude
  ): Promise<AdminSession[]> {
    return prisma.adminSession.findMany({
      where: {
        adminUserId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
      include,
    });
  }

  /**
   * Create a new session
   */
  async create(
    data: CreateAdminSessionInput,
    include?: AdminSessionInclude
  ): Promise<AdminSession> {
    return prisma.adminSession.create({
      data: {
        adminUserId: data.adminUserId,
        token: data.token,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
      include,
    });
  }

  /**
   * Update session's last active time
   */
  async updateLastActive(id: string): Promise<AdminSession> {
    return prisma.adminSession.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Delete session (logout)
   */
  async delete(id: string): Promise<void> {
    await prisma.adminSession.delete({
      where: { id },
    });
  }

  /**
   * Delete session by token
   */
  async deleteByToken(token: string): Promise<void> {
    await prisma.adminSession.delete({
      where: { token },
    });
  }

  /**
   * Delete all sessions for an admin user (logout everywhere)
   */
  async deleteAllForUser(adminUserId: string): Promise<number> {
    const result = await prisma.adminSession.deleteMany({
      where: { adminUserId },
    });
    return result.count;
  }

  /**
   * Delete expired sessions (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.adminSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  /**
   * Count active sessions for a user
   */
  async countActiveForUser(adminUserId: string): Promise<number> {
    return prisma.adminSession.count({
      where: {
        adminUserId,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Validate session - check if exists and not expired
   */
  async validateSession(
    token: string,
    include?: AdminSessionInclude
  ): Promise<AdminSession | null> {
    const session = await prisma.adminSession.findUnique({
      where: { token },
      include,
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Session expired, clean it up
      await this.delete(session.id);
      return null;
    }

    // Update last active time
    return prisma.adminSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
      include,
    });
  }
}

export const adminSessionRepository = new AdminSessionRepository();
