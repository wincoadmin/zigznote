/**
 * @ownership
 * @domain Calendar Integration
 * @description Handles calendar connection CRUD operations
 * @single-responsibility YES — calendar connections only
 * @last-reviewed 2026-01-04
 */

import type { CalendarConnection, Prisma } from '@prisma/client';
import { prisma } from '../client';

/**
 * Create calendar connection input
 */
export interface CreateCalendarConnectionInput {
  userId: string;
  provider: 'google' | 'microsoft';
  accessToken?: string;
  refreshToken?: string;
  tokenExpires?: Date;
  calendarId?: string;
}

/**
 * Update calendar connection input
 */
export interface UpdateCalendarConnectionInput {
  accessToken?: string;
  refreshToken?: string;
  tokenExpires?: Date;
  calendarId?: string;
  syncEnabled?: boolean;
  autoRecord?: boolean;
  lastSyncedAt?: Date;
}

/**
 * Repository for CalendarConnection operations
 */
export class CalendarRepository {
  /**
   * Finds a calendar connection by ID
   */
  async findById(id: string): Promise<CalendarConnection | null> {
    return prisma.calendarConnection.findUnique({
      where: { id },
    });
  }

  /**
   * Finds a calendar connection by user ID and provider
   */
  async findByUserAndProvider(
    userId: string,
    provider: string
  ): Promise<CalendarConnection | null> {
    return prisma.calendarConnection.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  /**
   * Finds all calendar connections for a user
   */
  async findByUserId(userId: string): Promise<CalendarConnection[]> {
    return prisma.calendarConnection.findMany({
      where: { userId },
    });
  }

  /**
   * Finds all active calendar connections that need syncing
   * @param syncInterval - Minutes since last sync
   */
  async findStaleConnections(syncInterval = 15): Promise<CalendarConnection[]> {
    const cutoff = new Date(Date.now() - syncInterval * 60 * 1000);

    return prisma.calendarConnection.findMany({
      where: {
        syncEnabled: true,
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: cutoff } },
        ],
      },
      include: {
        user: {
          select: { organizationId: true },
        },
      },
    });
  }

  /**
   * Creates a new calendar connection
   */
  async create(data: CreateCalendarConnectionInput): Promise<CalendarConnection> {
    return prisma.calendarConnection.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpires: data.tokenExpires,
        calendarId: data.calendarId,
        syncEnabled: true,
      },
    });
  }

  /**
   * Updates a calendar connection
   */
  async update(id: string, data: UpdateCalendarConnectionInput): Promise<CalendarConnection> {
    return prisma.calendarConnection.update({
      where: { id },
      data,
    });
  }

  /**
   * Updates tokens for a calendar connection
   */
  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken: string | null,
    tokenExpires: Date
  ): Promise<CalendarConnection> {
    const data: Prisma.CalendarConnectionUpdateInput = {
      accessToken,
      tokenExpires,
    };

    if (refreshToken) {
      data.refreshToken = refreshToken;
    }

    return prisma.calendarConnection.update({
      where: { id },
      data,
    });
  }

  /**
   * Updates last synced timestamp
   */
  async updateLastSynced(id: string): Promise<CalendarConnection> {
    return prisma.calendarConnection.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }

  /**
   * Disables sync for a connection
   */
  async disableSync(id: string): Promise<CalendarConnection> {
    return prisma.calendarConnection.update({
      where: { id },
      data: { syncEnabled: false },
    });
  }

  /**
   * Enables sync for a connection
   */
  async enableSync(id: string): Promise<CalendarConnection> {
    return prisma.calendarConnection.update({
      where: { id },
      data: { syncEnabled: true },
    });
  }

  /**
   * Deletes a calendar connection
   */
  async delete(id: string): Promise<void> {
    await prisma.calendarConnection.delete({
      where: { id },
    });
  }

  /**
   * Deletes all connections for a user
   */
  async deleteByUserId(userId: string): Promise<void> {
    await prisma.calendarConnection.deleteMany({
      where: { userId },
    });
  }

  /**
   * Checks if a connection exists for user and provider
   */
  async exists(userId: string, provider: string): Promise<boolean> {
    const count = await prisma.calendarConnection.count({
      where: { userId, provider },
    });
    return count > 0;
  }

  /**
   * Counts active connections
   */
  async countActive(): Promise<number> {
    return prisma.calendarConnection.count({
      where: { syncEnabled: true },
    });
  }

  /**
   * Finds all connections with auto-record enabled
   */
  async findAutoRecordConnections(): Promise<
    Array<CalendarConnection & { user: { organizationId: string | null } }>
  > {
    return prisma.calendarConnection.findMany({
      where: {
        autoRecord: true,
        syncEnabled: true,
      },
      include: {
        user: {
          select: { organizationId: true },
        },
      },
    });
  }
}

// Export singleton instance
export const calendarRepository = new CalendarRepository();
