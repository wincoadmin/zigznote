/**
 * Audit logging service
 * Centralized service for logging all admin actions
 */

import { auditLogRepository } from '@zigznote/database';
import type { AuditLog } from '@zigznote/database';
import type { PaginatedResult, AuditLogFilterOptions } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Standard audit actions
 */
export const AuditActions = {
  // Admin auth
  ADMIN_LOGIN: 'admin.login',
  ADMIN_LOGOUT: 'admin.logout',
  ADMIN_2FA_ENABLED: 'admin.2fa_enabled',
  ADMIN_2FA_DISABLED: 'admin.2fa_disabled',
  ADMIN_PASSWORD_CHANGED: 'admin.password_changed',

  // Admin user management
  ADMIN_USER_CREATED: 'admin_user.created',
  ADMIN_USER_UPDATED: 'admin_user.updated',
  ADMIN_USER_DELETED: 'admin_user.deleted',
  ADMIN_USER_DEACTIVATED: 'admin_user.deactivated',

  // User management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_IMPERSONATED: 'user.impersonated',

  // Organization management
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_DELETED: 'organization.deleted',
  ORG_BILLING_OVERRIDE: 'organization.billing_override',

  // API key management
  SYSTEM_API_KEY_CREATED: 'system_api_key.created',
  SYSTEM_API_KEY_UPDATED: 'system_api_key.updated',
  SYSTEM_API_KEY_DELETED: 'system_api_key.deleted',
  SYSTEM_API_KEY_ROTATED: 'system_api_key.rotated',

  // Feature flags
  FEATURE_FLAG_CREATED: 'feature_flag.created',
  FEATURE_FLAG_UPDATED: 'feature_flag.updated',
  FEATURE_FLAG_TOGGLED: 'feature_flag.toggled',
  FEATURE_FLAG_DELETED: 'feature_flag.deleted',

  // System config
  CONFIG_UPDATED: 'config.updated',
  CONFIG_DELETED: 'config.deleted',

  // Security
  SECURITY_ALERT: 'security.alert',
  ACCESS_DENIED: 'security.access_denied',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export interface AuditContext {
  adminId?: string;
  ipAddress: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  action: AuditAction | string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

class AuditService {
  /**
   * Log an admin action
   */
  async log(context: AuditContext, entry: AuditLogEntry): Promise<AuditLog> {
    const auditLog = await auditLogRepository.create({
      adminUserId: context.adminId || null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      details: (entry.details || {}) as Record<string, string | number | boolean | null>,
      previousData: (entry.previousData || null) as Record<string, string | number | boolean | null> | null,
      newData: (entry.newData || null) as Record<string, string | number | boolean | null> | null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent || null,
    });

    // Also log to application logger for real-time monitoring
    logger.info(
      {
        auditLogId: auditLog.id,
        adminId: context.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ip: context.ipAddress,
      },
      'Audit log created'
    );

    return auditLog;
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    context: AuditContext,
    event: string,
    details: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.log(context, {
      action: AuditActions.SECURITY_ALERT,
      entityType: 'security',
      details: { event, ...details },
    });
  }

  /**
   * Log access denied event
   */
  async logAccessDenied(
    context: AuditContext,
    resource: string,
    reason: string
  ): Promise<AuditLog> {
    return this.log(context, {
      action: AuditActions.ACCESS_DENIED,
      entityType: 'security',
      details: { resource, reason },
    });
  }

  /**
   * Get audit logs with pagination
   */
  async getLogs(
    options: { page?: number; limit?: number },
    filter?: AuditLogFilterOptions
  ): Promise<PaginatedResult<AuditLog>> {
    return auditLogRepository.findManyPaginated(
      options,
      filter,
      { createdAt: 'desc' },
      { adminUser: { select: { id: true, name: true, email: true } } }
    );
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit = 50
  ): Promise<AuditLog[]> {
    return auditLogRepository.findByEntity(entityType, entityId, limit);
  }

  /**
   * Get recent activity for an admin
   */
  async getAdminActivity(adminId: string, limit = 100): Promise<AuditLog[]> {
    return auditLogRepository.findByAdminUser(adminId, limit);
  }

  /**
   * Get action statistics
   */
  async getActionStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ action: string; count: number }[]> {
    return auditLogRepository.countByAction(startDate, endDate);
  }

  /**
   * Clean up old audit logs (retention policy)
   * Default: 90 days
   */
  async cleanup(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await auditLogRepository.deleteOlderThan(cutoffDate);

    logger.info(
      { retentionDays, cutoffDate, deleted },
      'Audit log cleanup completed'
    );

    return deleted;
  }

  /**
   * Export audit logs for a date range
   */
  async exportLogs(
    startDate: Date,
    endDate: Date,
    filter?: Omit<AuditLogFilterOptions, 'startDate' | 'endDate'>
  ): Promise<AuditLog[]> {
    return auditLogRepository.findMany(
      { ...filter, startDate, endDate },
      { createdAt: 'asc' },
      { adminUser: { select: { id: true, name: true, email: true } } }
    );
  }
}

export const auditService = new AuditService();
