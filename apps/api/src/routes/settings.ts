/**
 * @ownership
 * @domain User & Organization Settings
 * @description API routes for notification preferences and organization configuration
 * @single-responsibility YES — handles all user and org settings operations
 * @last-reviewed 2026-01-06
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { AppError } from '@zigznote/shared';
import { usageService } from '../services/usageService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const settingsRouter: RouterType = Router();

// All settings routes require authentication
settingsRouter.use(requireAuth);

// Validation schemas
const updateNotificationPreferencesSchema = z.object({
  emailMeetingReady: z.boolean().optional(),
  emailActionItemReminder: z.boolean().optional(),
  emailWeeklyDigest: z.boolean().optional(),
  emailMeetingShared: z.boolean().optional(),
  emailPaymentAlerts: z.boolean().optional(),
  actionItemReminderDays: z.number().min(1).max(7).optional(),
});

const updateOrganizationSettingsSchema = z.object({
  recordingConsentEnabled: z.boolean().optional(),
  consentAnnouncementText: z.string().max(500).nullable().optional(),
  requireExplicitConsent: z.boolean().optional(),
  defaultBotName: z.string().min(1).max(50).optional(),
  joinAnnouncementEnabled: z.boolean().optional(),
  // Meeting defaults
  autoJoinMeetings: z.boolean().optional(),
  autoGenerateSummaries: z.boolean().optional(),
  extractActionItems: z.boolean().optional(),
});

const updateOrganizationNameSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * GET /api/v1/settings/notifications
 * Get current user's notification preferences
 */
settingsRouter.get(
  '/notifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get or create notification preferences
      let preferences = await prisma.notificationPreferences.findUnique({
        where: { userId: user.id },
      });

      if (!preferences) {
        // Create default preferences
        preferences = await prisma.notificationPreferences.create({
          data: { userId: user.id },
        });
      }

      res.json({
        success: true,
        data: {
          emailMeetingReady: preferences.emailMeetingReady,
          emailActionItemReminder: preferences.emailActionItemReminder,
          emailWeeklyDigest: preferences.emailWeeklyDigest,
          emailMeetingShared: preferences.emailMeetingShared,
          emailPaymentAlerts: preferences.emailPaymentAlerts,
          actionItemReminderDays: preferences.actionItemReminderDays,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/settings/notifications
 * Update current user's notification preferences
 */
settingsRouter.patch(
  '/notifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const validationResult = updateNotificationPreferencesSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Upsert notification preferences
      const preferences = await prisma.notificationPreferences.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...validationResult.data,
        },
        update: validationResult.data,
      });

      res.json({
        success: true,
        data: {
          emailMeetingReady: preferences.emailMeetingReady,
          emailActionItemReminder: preferences.emailActionItemReminder,
          emailWeeklyDigest: preferences.emailWeeklyDigest,
          emailMeetingShared: preferences.emailMeetingShared,
          emailPaymentAlerts: preferences.emailPaymentAlerts,
          actionItemReminderDays: preferences.actionItemReminderDays,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/settings/organization
 * Get organization settings (requires admin role)
 */
settingsRouter.get(
  '/organization',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get user with organization
      const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { organization: true },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get or create organization settings
      let settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: user.organizationId },
      });

      if (!settings) {
        // Create default settings
        settings = await prisma.organizationSettings.create({
          data: { organizationId: user.organizationId },
        });
      }

      res.json({
        success: true,
        data: {
          // Organization info
          organizationName: user.organization?.name || '',
          // Recording consent
          recordingConsentEnabled: settings.recordingConsentEnabled,
          consentAnnouncementText: settings.consentAnnouncementText,
          requireExplicitConsent: settings.requireExplicitConsent,
          // Bot settings
          defaultBotName: settings.defaultBotName,
          joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
          // Meeting defaults
          autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
          autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
          extractActionItems: (settings as any).extractActionItems ?? true,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/settings/organization
 * Update organization settings (requires admin role)
 */
settingsRouter.patch(
  '/organization',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const validationResult = updateOrganizationSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      // Get user with organization and check admin role
      const user = await prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.role !== 'admin') {
        throw new AppError('Admin role required to update organization settings', 403, 'FORBIDDEN');
      }

      // Upsert organization settings
      const settings = await prisma.organizationSettings.upsert({
        where: { organizationId: user.organizationId },
        create: {
          organizationId: user.organizationId,
          ...validationResult.data,
        },
        update: validationResult.data,
      });

      res.json({
        success: true,
        data: {
          recordingConsentEnabled: settings.recordingConsentEnabled,
          consentAnnouncementText: settings.consentAnnouncementText,
          requireExplicitConsent: settings.requireExplicitConsent,
          defaultBotName: settings.defaultBotName,
          joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
          autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
          autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
          extractActionItems: (settings as any).extractActionItems ?? true,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/settings/organization/name
 * Update organization name (requires admin role)
 */
settingsRouter.patch(
  '/organization/name',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const validationResult = updateOrganizationNameSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      // Get user and check admin role
      const user = await prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.role !== 'admin') {
        throw new AppError('Admin role required to update organization name', 403, 'FORBIDDEN');
      }

      // Update organization name
      const organization = await prisma.organization.update({
        where: { id: user.organizationId },
        data: { name: validationResult.data.name },
      });

      res.json({
        success: true,
        data: {
          name: organization.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/settings/usage
 * Get organization usage and quota status
 */
settingsRouter.get(
  '/usage',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const usage = await usageService.getUsageSummary(user.organizationId);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default settingsRouter;
