/**
 * Audit log repository
 * Handles creation and querying of admin audit logs
 */

import { Prisma, type AuditLog } from '@prisma/client';
import { prisma } from '../client';
import type {
  PaginationOptions,
  PaginatedResult,
  CreateAuditLogInput,
  AuditLogFilterOptions,
} from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

export type AuditLogInclude = Prisma.AuditLogInclude;

export class AuditLogRepository {
  /**
   * Find audit log by ID
   */
  async findById(
    id: string,
    include?: AuditLogInclude
  ): Promise<AuditLog | null> {
    return prisma.auditLog.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Find audit logs with filters
   */
  async findMany(
    filter?: AuditLogFilterOptions,
    orderBy?: Prisma.AuditLogOrderByWithRelationInput,
    include?: AuditLogInclude,
    limit?: number
  ): Promise<AuditLog[]> {
    const where = this.buildWhereClause(filter);
    return prisma.auditLog.findMany({
      where,
      orderBy: orderBy || { createdAt: 'desc' },
      include,
      take: limit,
    });
  }

  /**
   * Find audit logs with pagination
   */
  async findManyPaginated(
    options: PaginationOptions,
    filter?: AuditLogFilterOptions,
    orderBy?: Prisma.AuditLogOrderByWithRelationInput,
    include?: AuditLogInclude
  ): Promise<PaginatedResult<AuditLog>> {
    const normalized = normalizePaginationOptions(options);
    const where = this.buildWhereClause(filter);

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        include,
        skip: calculateSkip(normalized.page, normalized.limit),
        take: normalized.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(data, total, normalized);
  }

  /**
   * Create audit log entry
   */
  async create(data: CreateAuditLogInput): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        adminUserId: data.adminUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        details: data.details || {},
        previousData: data.previousData ?? Prisma.JsonNull,
        newData: data.newData ?? Prisma.JsonNull,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    limit?: number
  ): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { adminUser: { select: { id: true, name: true, email: true } } },
      take: limit,
    });
  }

  /**
   * Get recent audit logs for an admin user
   */
  async findByAdminUser(
    adminUserId: string,
    limit?: number
  ): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { adminUserId },
      orderBy: { createdAt: 'desc' },
      take: limit || 100,
    });
  }

  /**
   * Get audit logs by action type
   */
  async findByAction(
    action: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = { action };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { adminUser: { select: { id: true, name: true, email: true } } },
      take: limit,
    });
  }

  /**
   * Count audit logs by action (for stats)
   */
  async countByAction(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ action: string; count: number }[]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const result = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });

    return result.map((r) => ({
      action: r.action,
      count: r._count.action,
    }));
  }

  /**
   * Delete old audit logs (retention policy)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: date },
      },
    });
    return result.count;
  }

  private buildWhereClause(filter?: AuditLogFilterOptions): Prisma.AuditLogWhereInput {
    if (!filter) return {};

    const where: Prisma.AuditLogWhereInput = {};

    if (filter.adminUserId) {
      where.adminUserId = filter.adminUserId;
    }

    if (filter.action) {
      where.action = Array.isArray(filter.action) ? { in: filter.action } : filter.action;
    }

    if (filter.entityType) {
      where.entityType = Array.isArray(filter.entityType)
        ? { in: filter.entityType }
        : filter.entityType;
    }

    if (filter.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    return where;
  }
}

export const auditLogRepository = new AuditLogRepository();
