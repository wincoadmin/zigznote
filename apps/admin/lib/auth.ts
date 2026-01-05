/**
 * Admin authentication utilities
 */

import { authApi } from './api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
}

export type AdminRole = AdminUser['role'];

/**
 * Role hierarchy for permission checks
 * Higher number = more permissions
 */
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  viewer: 1,
  support: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Check if a user has at least the required role level
 */
export function hasRole(userRole: AdminRole, requiredRole: AdminRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can perform specific actions
 */
export const permissions = {
  canViewUsers: (role: AdminRole) => hasRole(role, 'viewer'),
  canEditUsers: (role: AdminRole) => hasRole(role, 'support'),
  canDeleteUsers: (role: AdminRole) => hasRole(role, 'admin'),
  canImpersonateUsers: (role: AdminRole) => hasRole(role, 'support'),

  canViewOrganizations: (role: AdminRole) => hasRole(role, 'viewer'),
  canEditOrganizations: (role: AdminRole) => hasRole(role, 'support'),
  canDeleteOrganizations: (role: AdminRole) => hasRole(role, 'admin'),
  canOverrideBilling: (role: AdminRole) => hasRole(role, 'admin'),

  canViewApiKeys: (role: AdminRole) => hasRole(role, 'admin'),
  canManageApiKeys: (role: AdminRole) => hasRole(role, 'super_admin'),

  canViewAuditLogs: (role: AdminRole) => hasRole(role, 'support'),
  canExportAuditLogs: (role: AdminRole) => hasRole(role, 'admin'),

  canViewSystemConfig: (role: AdminRole) => hasRole(role, 'admin'),
  canEditSystemConfig: (role: AdminRole) => hasRole(role, 'super_admin'),

  canManageFeatureFlags: (role: AdminRole) => hasRole(role, 'admin'),

  canManageAdmins: (role: AdminRole) => hasRole(role, 'super_admin'),
};

/**
 * Get current admin user from API
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const response = await authApi.me();
    if (response.success && response.data) {
      return response.data.user as AdminUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Logout current admin
 */
export async function logout(): Promise<void> {
  await authApi.logout();
  window.location.href = '/login';
}
