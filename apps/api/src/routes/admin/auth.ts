/**
 * Admin authentication routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { adminAuthService } from '../../services/adminAuthService';
import { auditLogRepository } from '@zigznote/database';
import {
  requireAdminAuth,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const adminAuthRouter: IRouter = Router();

// Validation schemas
const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
};

const verify2FASchema = {
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }),
};

const enable2FASchema = {
  body: z.object({
    code: z.string().length(6),
  }),
};

const initialSetupSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(12),
    name: z.string().min(2).max(100),
  }),
};

/**
 * @route POST /api/admin/auth/login
 * @description Admin login step 1 - validate credentials
 */
adminAuthRouter.post(
  '/login',
  validateRequest(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await adminAuthService.login(email, password, ipAddress, userAgent);

    if (result.requiresTwoFactor) {
      res.json({
        success: true,
        requiresTwoFactor: true,
        message: 'Please enter your 2FA code',
      });
      return;
    }

    // Set session cookie
    if (result.session) {
      res.cookie('admin_token', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: result.session.expiresAt,
      });
    }

    // Log the action
    if (result.user) {
      await auditLogRepository.create({
        adminUserId: result.user.id,
        action: 'admin.login',
        entityType: 'admin_user',
        entityId: result.user.id,
        details: { method: 'password' },
        ipAddress,
        userAgent,
      });
    }

    res.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  })
);

/**
 * @route POST /api/admin/auth/verify-2fa
 * @description Admin login step 2 - verify 2FA code
 */
adminAuthRouter.post(
  '/verify-2fa',
  validateRequest(verify2FASchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, code } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await adminAuthService.verify2FA(email, code, ipAddress, userAgent);

    // Set session cookie
    if (result.session) {
      res.cookie('admin_token', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: result.session.expiresAt,
      });
    }

    // Log the action
    if (result.user) {
      await auditLogRepository.create({
        adminUserId: result.user.id,
        action: 'admin.login',
        entityType: 'admin_user',
        entityId: result.user.id,
        details: { method: '2fa' },
        ipAddress,
        userAgent,
      });
    }

    res.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  })
);

/**
 * @route POST /api/admin/auth/logout
 * @description Logout current admin session
 */
adminAuthRouter.post(
  '/logout',
  requireAdminAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const token = req.cookies?.admin_token || req.headers.authorization?.slice(7);

    if (token) {
      await adminAuthService.logout(token);
    }

    // Log the action
    await auditLogRepository.create({
      adminUserId: adminReq.adminAuth?.adminId,
      action: 'admin.logout',
      entityType: 'admin_user',
      entityId: adminReq.adminAuth?.adminId,
      details: {},
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || null,
    });

    // Clear cookie
    res.clearCookie('admin_token');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * @route GET /api/admin/auth/me
 * @description Get current admin user info
 */
adminAuthRouter.get(
  '/me',
  requireAdminAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;

    res.json({
      success: true,
      data: {
        user: {
          id: adminReq.adminAuth!.adminId,
          email: adminReq.adminAuth!.email,
          name: adminReq.adminAuth!.name,
          role: adminReq.adminAuth!.role,
        },
      },
    });
  })
);

/**
 * @route POST /api/admin/auth/setup-2fa
 * @description Start 2FA setup - get secret and QR code
 */
adminAuthRouter.post(
  '/setup-2fa',
  requireAdminAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;

    const result = await adminAuthService.setup2FA(adminReq.adminAuth!.adminId);

    res.json({
      success: true,
      data: {
        secret: result.secret,
        qrCodeUrl: result.otpauthUrl,
      },
    });
  })
);

/**
 * @route POST /api/admin/auth/enable-2fa
 * @description Complete 2FA setup - verify code and enable
 */
adminAuthRouter.post(
  '/enable-2fa',
  requireAdminAuth,
  validateRequest(enable2FASchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { code } = req.body;

    const result = await adminAuthService.enable2FA(adminReq.adminAuth!.adminId, code);

    // Log the action
    await auditLogRepository.create({
      adminUserId: adminReq.adminAuth!.adminId,
      action: 'admin.2fa_enabled',
      entityType: 'admin_user',
      entityId: adminReq.adminAuth!.adminId,
      details: {},
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || null,
    });

    res.json({
      success: true,
      data: {
        backupCodes: result.backupCodes,
      },
      message: '2FA enabled successfully. Save your backup codes!',
    });
  })
);

/**
 * @route POST /api/admin/auth/disable-2fa
 * @description Disable 2FA
 */
adminAuthRouter.post(
  '/disable-2fa',
  requireAdminAuth,
  validateRequest(enable2FASchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { code } = req.body;

    await adminAuthService.disable2FA(adminReq.adminAuth!.adminId, code);

    // Log the action
    await auditLogRepository.create({
      adminUserId: adminReq.adminAuth!.adminId,
      action: 'admin.2fa_disabled',
      entityType: 'admin_user',
      entityId: adminReq.adminAuth!.adminId,
      details: {},
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || null,
    });

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  })
);

/**
 * @route GET /api/admin/auth/setup-status
 * @description Check if initial setup is needed
 */
adminAuthRouter.get(
  '/setup-status',
  asyncHandler(async (_req: Request, res: Response) => {
    const needsSetup = await adminAuthService.needsInitialSetup();

    res.json({
      success: true,
      data: {
        needsSetup,
      },
    });
  })
);

/**
 * @route POST /api/admin/auth/initial-setup
 * @description Create the first super admin (only works if no admins exist)
 */
adminAuthRouter.post(
  '/initial-setup',
  validateRequest(initialSetupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const admin = await adminAuthService.createInitialAdmin(email, password, name);

    // Log the action
    await auditLogRepository.create({
      adminUserId: admin.id,
      action: 'admin.initial_setup',
      entityType: 'admin_user',
      entityId: admin.id,
      details: { email },
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      message: 'Initial admin created. Please login.',
    });
  })
);
