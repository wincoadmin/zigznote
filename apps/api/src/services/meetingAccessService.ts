/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for checking meeting access permissions based on ownership and shares
 * @single-responsibility YES - handles all meeting access/permission logic
 * @last-reviewed 2026-01-07
 */

import { prisma, SharePermission } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Permission levels in order of increasing access
 */
export const PERMISSION_LEVELS: Record<SharePermission, number> = {
  VIEWER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  ADMIN: 4,
};

/**
 * Access result returned from permission checks
 */
export interface MeetingAccessResult {
  hasAccess: boolean;
  isOwner: boolean;
  isSameOrg: boolean;
  permission: SharePermission | null;
  meetingId: string;
  userId: string;
}

/**
 * Service for checking meeting access permissions
 */
export class MeetingAccessService {
  /**
   * Check if user has access to a meeting and at what level
   * @param meetingId - Meeting ID
   * @param userId - User ID
   * @param organizationId - User's organization ID
   */
  async checkAccess(
    meetingId: string,
    userId: string,
    organizationId: string
  ): Promise<MeetingAccessResult> {
    logger.debug({ meetingId, userId }, 'Checking meeting access');

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
      },
    });

    if (!meeting) {
      return {
        hasAccess: false,
        isOwner: false,
        isSameOrg: false,
        permission: null,
        meetingId,
        userId,
      };
    }

    // Check if user is the creator (owner)
    const isOwner = meeting.createdById === userId;

    // Check if user is in the same organization
    const isSameOrg = meeting.organizationId === organizationId;

    // If same org, they have at least VIEWER access (org members can view all org meetings)
    if (isSameOrg) {
      // Owner gets ADMIN permission
      const permission: SharePermission = isOwner ? 'ADMIN' : 'EDITOR';
      return {
        hasAccess: true,
        isOwner,
        isSameOrg,
        permission,
        meetingId,
        userId,
      };
    }

    // Check for explicit share
    const share = await prisma.meetingShare.findFirst({
      where: {
        meetingId,
        userId,
        revokedAt: null,
        OR: [
          { linkExpires: null },
          { linkExpires: { gt: new Date() } },
        ],
      },
      select: {
        permission: true,
        maxViews: true,
        viewCount: true,
      },
    });

    if (share) {
      // Check view limit
      if (share.maxViews && share.viewCount >= share.maxViews) {
        return {
          hasAccess: false,
          isOwner: false,
          isSameOrg: false,
          permission: null,
          meetingId,
          userId,
        };
      }

      return {
        hasAccess: true,
        isOwner: false,
        isSameOrg: false,
        permission: share.permission,
        meetingId,
        userId,
      };
    }

    // No access
    return {
      hasAccess: false,
      isOwner: false,
      isSameOrg: false,
      permission: null,
      meetingId,
      userId,
    };
  }

  /**
   * Check if user has at least the specified permission level
   * @param meetingId - Meeting ID
   * @param userId - User ID
   * @param organizationId - User's organization ID
   * @param requiredPermission - Minimum required permission
   */
  async hasPermission(
    meetingId: string,
    userId: string,
    organizationId: string,
    requiredPermission: SharePermission
  ): Promise<boolean> {
    const access = await this.checkAccess(meetingId, userId, organizationId);

    if (!access.hasAccess || !access.permission) {
      return false;
    }

    const userLevel = PERMISSION_LEVELS[access.permission] ?? 0;
    const requiredLevel = PERMISSION_LEVELS[requiredPermission] ?? 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Check if user can view a meeting
   */
  async canView(meetingId: string, userId: string, organizationId: string): Promise<boolean> {
    return this.hasPermission(meetingId, userId, organizationId, 'VIEWER');
  }

  /**
   * Check if user can comment on a meeting
   */
  async canComment(meetingId: string, userId: string, organizationId: string): Promise<boolean> {
    return this.hasPermission(meetingId, userId, organizationId, 'COMMENTER');
  }

  /**
   * Check if user can edit/annotate a meeting
   */
  async canEdit(meetingId: string, userId: string, organizationId: string): Promise<boolean> {
    return this.hasPermission(meetingId, userId, organizationId, 'EDITOR');
  }

  /**
   * Check if user can manage sharing for a meeting
   */
  async canManage(meetingId: string, userId: string, organizationId: string): Promise<boolean> {
    return this.hasPermission(meetingId, userId, organizationId, 'ADMIN');
  }

  /**
   * Record a view on a shared meeting (increments view count)
   */
  async recordView(meetingId: string, userId: string): Promise<void> {
    await prisma.meetingShare.updateMany({
      where: {
        meetingId,
        userId,
        revokedAt: null,
      },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Get all users who have access to a meeting (for @mentions autocomplete)
   * @param meetingId - Meeting ID
   * @param organizationId - Organization ID
   */
  async getAccessibleUsers(
    meetingId: string,
    organizationId: string
  ): Promise<Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>> {
    // Get all org members
    const orgMembers = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });

    // Get external users with explicit shares
    const shares = await prisma.meetingShare.findMany({
      where: {
        meetingId,
        revokedAt: null,
        userId: { not: null },
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            organizationId: true,
          },
        },
      },
    });

    // Combine and deduplicate
    const userMap = new Map<string, { id: string; name: string | null; email: string; avatarUrl: string | null }>();

    for (const member of orgMembers) {
      const displayName = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || null;
      userMap.set(member.id, {
        id: member.id,
        name: displayName,
        email: member.email,
        avatarUrl: member.avatarUrl,
      });
    }

    for (const share of shares) {
      if (share.user && share.user.organizationId !== organizationId) {
        const displayName = share.user.name || `${share.user.firstName || ''} ${share.user.lastName || ''}`.trim() || null;
        userMap.set(share.user.id, {
          id: share.user.id,
          name: displayName,
          email: share.user.email,
          avatarUrl: share.user.avatarUrl,
        });
      }
    }

    return Array.from(userMap.values());
  }
}

export const meetingAccessService = new MeetingAccessService();
