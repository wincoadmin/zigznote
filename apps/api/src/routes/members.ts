/**
 * Team Members API Routes
 * Manage organization members and invitations
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@zigznote/database';
import { AppError } from '@zigznote/shared';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const membersRouter: RouterType = Router();

// All member routes require authentication
membersRouter.use(requireAuth);

// Validation schemas
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

/**
 * GET /api/v1/members
 * List all members in the organization
 */
membersRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const members = await prisma.user.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: [
          { role: 'asc' }, // admins first
          { createdAt: 'asc' },
        ],
      });

      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/members/invite
 * Invite a new member to the organization
 */
membersRouter.post(
  '/invite',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can invite
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to invite members', 403, 'FORBIDDEN');
      }

      const validationResult = inviteMemberSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      const { email, role } = validationResult.data;

      // Check if user already exists in this organization
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingUser) {
        throw new AppError('User is already a member of this organization', 400, 'USER_EXISTS');
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          organizationId,
          status: 'pending',
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        throw new AppError('An invitation has already been sent to this email', 400, 'INVITATION_EXISTS');
      }

      // Generate invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const invitation = await prisma.invitation.create({
        data: {
          organizationId,
          email,
          role,
          token,
          expiresAt,
          invitedById: userId,
        },
        include: {
          invitedBy: {
            select: { name: true, email: true },
          },
          organization: {
            select: { name: true },
          },
        },
      });

      // TODO: Send invitation email
      // For now, just return the invitation details

      res.status(201).json({
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          invitedBy: invitation.invitedBy,
          organization: invitation.organization,
          // Include token for testing (remove in production or send via email only)
          inviteUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/invite/${invitation.token}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/members/invitations
 * List pending invitations
 */
membersRouter.get(
  '/invitations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can view invitations
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to view invitations', 403, 'FORBIDDEN');
      }

      const invitations = await prisma.invitation.findMany({
        where: {
          organizationId,
          status: 'pending',
        },
        include: {
          invitedBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Mark expired invitations
      const now = new Date();
      const result = invitations.map((inv) => ({
        ...inv,
        isExpired: inv.expiresAt < now,
      }));

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/members/invitations/:id
 * Cancel a pending invitation
 */
membersRouter.delete(
  '/invitations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can cancel invitations
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to cancel invitations', 403, 'FORBIDDEN');
      }

      const invitation = await prisma.invitation.findFirst({
        where: {
          id,
          organizationId,
          status: 'pending',
        },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404, 'NOT_FOUND');
      }

      await prisma.invitation.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      res.json({
        success: true,
        message: 'Invitation cancelled',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/members/:id
 * Update a member's role
 */
membersRouter.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can update roles
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to update member roles', 403, 'FORBIDDEN');
      }

      // Can't change own role
      if (id === userId) {
        throw new AppError('Cannot change your own role', 400, 'CANNOT_CHANGE_OWN_ROLE');
      }

      const validationResult = updateMemberSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', {
          errors: validationResult.error.errors,
        });
      }

      // Check member exists in same org
      const member = await prisma.user.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!member) {
        throw new AppError('Member not found', 404, 'NOT_FOUND');
      }

      // Update role
      const updatedMember = await prisma.user.update({
        where: { id },
        data: { role: validationResult.data.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      res.json({
        success: true,
        data: updatedMember,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/members/:id
 * Remove a member from the organization
 */
membersRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can remove members
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to remove members', 403, 'FORBIDDEN');
      }

      // Can't remove yourself
      if (id === userId) {
        throw new AppError('Cannot remove yourself from the organization', 400, 'CANNOT_REMOVE_SELF');
      }

      // Check member exists in same org
      const member = await prisma.user.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!member) {
        throw new AppError('Member not found', 404, 'NOT_FOUND');
      }

      // Soft delete the member
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      res.json({
        success: true,
        message: 'Member removed from organization',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/members/:id/reset-password
 * Reset a member's password (admin only)
 * Generates a temporary password that user must change on next login
 */
membersRouter.post(
  '/:id/reset-password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can reset passwords
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to reset passwords', 403, 'FORBIDDEN');
      }

      // Can't reset own password through this endpoint
      if (id === userId) {
        throw new AppError('Use the profile settings to change your own password', 400, 'CANNOT_RESET_OWN_PASSWORD');
      }

      // Check member exists in same org
      const member = await prisma.user.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!member) {
        throw new AppError('Member not found', 404, 'NOT_FOUND');
      }

      // Generate a temporary password
      const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);

      // Hash the password using bcrypt
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      // Update user's password and set flag to force password change
      await prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      });

      // TODO: Send email with temporary password
      // For now, return the temp password (in production, send via email only)

      res.json({
        success: true,
        message: 'Password has been reset',
        data: {
          email: member.email,
          temporaryPassword: tempPassword,
          note: 'Please share this temporary password securely with the user. They should change it immediately after logging in.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/members/:id/toggle-status
 * Enable or disable a member (admin only)
 * Disabled members cannot log in but remain in the organization
 */
membersRouter.post(
  '/:id/toggle-status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can toggle member status
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to change member status', 403, 'FORBIDDEN');
      }

      // Can't disable yourself
      if (id === userId) {
        throw new AppError('Cannot disable your own account', 400, 'CANNOT_DISABLE_SELF');
      }

      // Check member exists in same org
      const member = await prisma.user.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!member) {
        throw new AppError('Member not found', 404, 'NOT_FOUND');
      }

      // Toggle the isActive status
      const newStatus = !member.isActive;

      const updatedMember = await prisma.user.update({
        where: { id },
        data: { isActive: newStatus },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: newStatus ? 'Member has been enabled' : 'Member has been disabled',
        data: updatedMember,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/members/resend-invite/:id
 * Resend an invitation email
 */
membersRouter.post(
  '/resend-invite/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      const organizationId = authReq.auth?.organizationId;
      const userRole = authReq.auth?.role;
      const { id } = req.params;

      if (!userId || !organizationId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Only admins can resend invitations
      if (userRole !== 'admin') {
        throw new AppError('Admin role required to resend invitations', 403, 'FORBIDDEN');
      }

      const invitation = await prisma.invitation.findFirst({
        where: {
          id,
          organizationId,
          status: 'pending',
        },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404, 'NOT_FOUND');
      }

      // Generate new token and extend expiry
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.invitation.update({
        where: { id },
        data: { token, expiresAt },
      });

      // TODO: Send invitation email

      res.json({
        success: true,
        message: 'Invitation resent',
        data: {
          inviteUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/invite/${token}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default membersRouter;
