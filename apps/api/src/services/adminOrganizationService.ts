/**
 * Admin organization management service
 * Handles organization CRUD and billing overrides for admin panel
 */

import { organizationRepository, userRepository } from '@zigznote/database';
import { type Organization, AccountType } from '@zigznote/database';
import type { PaginatedResult, OrganizationFilter } from '@zigznote/database';
import { auditService, AuditActions, type AuditContext } from './auditService';
import { AppError } from '../utils/errors';

export interface AdminOrganizationFilter extends OrganizationFilter {
  plan?: string;
  accountType?: AccountType;
  search?: string;
  includeDeleted?: boolean;
}

export interface OrganizationDetails {
  id: string;
  name: string;
  plan: string;
  accountType: AccountType;
  billingOverrideReason: string | null;
  billingOverrideBy: string | null;
  billingOverrideAt: Date | null;
  clerkId: string | null;
  settings: Record<string, unknown>;
  userCount?: number;
  meetingCount?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateOrganizationInput {
  name?: string;
  plan?: string;
  settings?: Record<string, unknown>;
}

export interface BillingOverrideInput {
  accountType: AccountType;
  reason: string;
}

class AdminOrganizationService {
  /**
   * List organizations with pagination and filters
   */
  async listOrganizations(
    options: { page?: number; limit?: number },
    filter?: AdminOrganizationFilter
  ): Promise<PaginatedResult<OrganizationDetails>> {
    const result = await organizationRepository.findManyPaginated(
      options,
      {
        plan: filter?.plan,
        search: filter?.search,
        includeDeleted: filter?.includeDeleted,
      },
      { users: true }
    );

    return {
      ...result,
      data: result.data.map((org) => this.toOrganizationDetails(org)),
    };
  }

  /**
   * Get a single organization by ID
   */
  async getOrganization(id: string, includeDeleted = false): Promise<OrganizationDetails | null> {
    const org = await organizationRepository.findById(id, { users: true }, includeDeleted);
    return org ? this.toOrganizationDetails(org) : null;
  }

  /**
   * Update organization
   */
  async updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
    context: AuditContext
  ): Promise<OrganizationDetails> {
    const existing = await organizationRepository.findById(id, { users: true });
    if (!existing) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const previousData: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      previousData.name = existing.name;
      updateData.name = input.name;
    }

    if (input.plan !== undefined) {
      previousData.plan = existing.plan;
      updateData.plan = input.plan;
    }

    if (input.settings !== undefined) {
      previousData.settings = existing.settings;
      updateData.settings = input.settings;
    }

    const updated = await organizationRepository.update(id, updateData, { users: true });

    await auditService.log(context, {
      action: AuditActions.ORG_UPDATED,
      entityType: 'organization',
      entityId: id,
      previousData,
      newData: updateData,
    });

    return this.toOrganizationDetails(updated);
  }

  /**
   * Set billing override for organization
   */
  async setBillingOverride(
    id: string,
    input: BillingOverrideInput,
    adminId: string,
    context: AuditContext
  ): Promise<OrganizationDetails> {
    const existing = await organizationRepository.findById(id, { users: true });
    if (!existing) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const previousData = {
      accountType: existing.accountType,
      billingOverrideReason: existing.billingOverrideReason,
      billingOverrideBy: existing.billingOverrideBy,
      billingOverrideAt: existing.billingOverrideAt,
    };

    const updated = await organizationRepository.update(
      id,
      {
        accountType: input.accountType,
        billingOverrideReason: input.reason,
        billingOverrideBy: adminId,
        billingOverrideAt: new Date(),
      } as Parameters<typeof organizationRepository.update>[1],
      { users: true }
    );

    await auditService.log(context, {
      action: AuditActions.ORG_BILLING_OVERRIDE,
      entityType: 'organization',
      entityId: id,
      previousData,
      newData: {
        accountType: input.accountType,
        billingOverrideReason: input.reason,
        billingOverrideBy: adminId,
        billingOverrideAt: new Date().toISOString(),
      },
      details: {
        reason: input.reason,
        newAccountType: input.accountType,
        previousAccountType: existing.accountType,
      },
    });

    return this.toOrganizationDetails(updated);
  }

  /**
   * Clear billing override
   */
  async clearBillingOverride(
    id: string,
    context: AuditContext
  ): Promise<OrganizationDetails> {
    const existing = await organizationRepository.findById(id, { users: true });
    if (!existing) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const previousData = {
      accountType: existing.accountType,
      billingOverrideReason: existing.billingOverrideReason,
      billingOverrideBy: existing.billingOverrideBy,
      billingOverrideAt: existing.billingOverrideAt,
    };

    const updated = await organizationRepository.update(
      id,
      {
        accountType: 'REGULAR' as AccountType,
        billingOverrideReason: null,
        billingOverrideBy: null,
        billingOverrideAt: null,
      } as Parameters<typeof organizationRepository.update>[1],
      { users: true }
    );

    await auditService.log(context, {
      action: AuditActions.ORG_BILLING_OVERRIDE,
      entityType: 'organization',
      entityId: id,
      previousData,
      newData: {
        accountType: 'REGULAR',
        billingOverrideReason: null,
        billingOverrideBy: null,
        billingOverrideAt: null,
      },
      details: { cleared: true },
    });

    return this.toOrganizationDetails(updated);
  }

  /**
   * Update organization plan
   */
  async updatePlan(
    id: string,
    plan: string,
    context: AuditContext
  ): Promise<OrganizationDetails> {
    const existing = await organizationRepository.findById(id, { users: true });
    if (!existing) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const updated = await organizationRepository.update(id, { plan }, { users: true });

    await auditService.log(context, {
      action: AuditActions.ORG_UPDATED,
      entityType: 'organization',
      entityId: id,
      previousData: { plan: existing.plan },
      newData: { plan },
      details: { planChanged: true },
    });

    return this.toOrganizationDetails(updated);
  }

  /**
   * Update organization settings
   */
  async updateSettings(
    id: string,
    settings: Record<string, unknown>,
    context: AuditContext
  ): Promise<OrganizationDetails> {
    const existing = await organizationRepository.findById(id);
    if (!existing) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const updated = await organizationRepository.updateSettings(id, settings);

    await auditService.log(context, {
      action: AuditActions.ORG_UPDATED,
      entityType: 'organization',
      entityId: id,
      previousData: { settings: existing.settings },
      newData: { settings: updated.settings },
      details: { settingsUpdated: true },
    });

    const withUsers = await organizationRepository.findById(id, { users: true });
    return this.toOrganizationDetails(withUsers!);
  }

  /**
   * Suspend organization (soft delete)
   */
  async suspendOrganization(id: string, context: AuditContext): Promise<void> {
    const org = await organizationRepository.findById(id);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    if (org.deletedAt) {
      throw new AppError('Organization is already suspended', 400, 'ALREADY_SUSPENDED');
    }

    await organizationRepository.softDelete(id);

    await auditService.log(context, {
      action: AuditActions.ORG_DELETED,
      entityType: 'organization',
      entityId: id,
      details: { suspended: true },
      previousData: { deletedAt: null },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  /**
   * Restore suspended organization
   */
  async restoreOrganization(id: string, context: AuditContext): Promise<OrganizationDetails> {
    const org = await organizationRepository.findById(id, { users: true }, true);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    if (!org.deletedAt) {
      throw new AppError('Organization is not suspended', 400, 'NOT_SUSPENDED');
    }

    await organizationRepository.restore(id);

    await auditService.log(context, {
      action: AuditActions.ORG_UPDATED,
      entityType: 'organization',
      entityId: id,
      details: { restored: true },
      previousData: { deletedAt: org.deletedAt.toISOString() },
      newData: { deletedAt: null },
    });

    const withUsers = await organizationRepository.findById(id, { users: true });
    return this.toOrganizationDetails(withUsers!);
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(): Promise<{
    total: number;
    active: number;
    suspended: number;
    byPlan: Record<string, number>;
    byAccountType: Record<string, number>;
    recentSignups: number;
  }> {
    const allOrgs = await organizationRepository.findMany({ includeDeleted: true });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = {
      total: allOrgs.length,
      active: 0,
      suspended: 0,
      byPlan: {} as Record<string, number>,
      byAccountType: {} as Record<string, number>,
      recentSignups: 0,
    };

    for (const org of allOrgs) {
      if (org.deletedAt) {
        stats.suspended++;
      } else {
        stats.active++;
      }

      stats.byPlan[org.plan] = (stats.byPlan[org.plan] || 0) + 1;
      stats.byAccountType[org.accountType] = (stats.byAccountType[org.accountType] || 0) + 1;

      if (org.createdAt >= thirtyDaysAgo) {
        stats.recentSignups++;
      }
    }

    return stats;
  }

  /**
   * Search organizations
   */
  async searchOrganizations(
    query: string,
    limit = 20
  ): Promise<OrganizationDetails[]> {
    const result = await organizationRepository.findManyPaginated(
      { page: 1, limit },
      { search: query },
      { users: true }
    );

    return result.data.map((org) => this.toOrganizationDetails(org));
  }

  /**
   * Get users in organization
   */
  async getOrganizationUsers(
    organizationId: string,
    options: { page?: number; limit?: number }
  ) {
    return userRepository.findByOrganization(organizationId, options, { organization: true });
  }

  /**
   * Convert organization to details DTO
   */
  private toOrganizationDetails(
    org: Organization & { users?: { id: string }[] }
  ): OrganizationDetails {
    return {
      id: org.id,
      name: org.name,
      plan: org.plan,
      accountType: org.accountType,
      billingOverrideReason: org.billingOverrideReason,
      billingOverrideBy: org.billingOverrideBy,
      billingOverrideAt: org.billingOverrideAt,
      clerkId: org.clerkId,
      settings: (org.settings as Record<string, unknown>) || {},
      userCount: org.users?.length,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      deletedAt: org.deletedAt,
    };
  }
}

export const adminOrganizationService = new AdminOrganizationService();
