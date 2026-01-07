/**
 * Microsoft Teams/365 Integration Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';
import { MicrosoftIntegration } from './MicrosoftIntegration';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';

const router: Router = Router();
const microsoftIntegration = new MicrosoftIntegration(prisma);

/**
 * GET /integrations/microsoft/connect
 * Initiate Microsoft OAuth flow
 */
router.get(
  '/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Check if Microsoft is configured
    if (!config.microsoft?.clientId || !config.microsoft?.clientSecret) {
      res.json({ error: 'not_configured' });
      return;
    }

    // Generate state with organization ID for callback
    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        nonce: crypto.randomBytes(16).toString('hex'),
      })
    ).toString('base64');

    const authUrl = microsoftIntegration.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  })
);

/**
 * GET /integrations/microsoft/callback
 * Handle Microsoft OAuth callback
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errorMsg = error_description || error;
      return res.redirect(`${config.webUrl}/settings/integrations?error=${encodeURIComponent(errorMsg as string)}`);
    }

    if (!code || !state) {
      throw new BadRequestError('Missing code or state');
    }

    // Decode state
    let stateData: { organizationId: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      throw new BadRequestError('Invalid state');
    }

    // Exchange code for tokens
    const tokenResult = await microsoftIntegration.exchangeCodeForTokens(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'OAuth failed')}`
      );
    }

    // Temporarily save connection to get user info
    const tempCredentials = {
      accessToken: tokenResult.data.accessToken,
      refreshToken: tokenResult.data.refreshToken,
      tokenExpires: tokenResult.data.expiresIn
        ? new Date(Date.now() + tokenResult.data.expiresIn * 1000)
        : undefined,
    };

    await microsoftIntegration['saveConnection'](stateData.organizationId, tempCredentials, {});

    // Get user info
    const userResult = await microsoftIntegration.getCurrentUser(stateData.organizationId);

    if (!userResult.success || !userResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent('Failed to get user info')}`
      );
    }

    // Save full connection with user info
    await microsoftIntegration.saveMicrosoftConnection(
      stateData.organizationId,
      tokenResult.data,
      userResult.data
    );

    // Redirect to settings page with success
    res.redirect(`${config.webUrl}/settings/integrations?microsoft-teams=connected`);
  })
);

/**
 * GET /integrations/microsoft/status
 * Get Microsoft connection status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const connection = await microsoftIntegration.getConnection(organizationId);

    if (!connection) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: connection.status === 'connected',
      status: connection.status,
      email: connection.credentials.email,
      userName: connection.settings.userName,
      connectedAt: connection.connectedAt,
    });
  })
);

/**
 * GET /integrations/microsoft/events
 * Get calendar events (includes Teams meetings)
 */
router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { startDate, endDate } = req.query;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const startDateTime = startDate ? new Date(startDate as string) : undefined;
    const endDateTime = endDate ? new Date(endDate as string) : undefined;

    const result = await microsoftIntegration.getCalendarEvents(
      organizationId,
      startDateTime,
      endDateTime
    );

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Microsoft not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch events');
    }

    res.json({ events: result.data });
  })
);

/**
 * GET /integrations/microsoft/meetings
 * Get Teams meetings only
 */
router.get(
  '/meetings',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { startDate, endDate } = req.query;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const startDateTime = startDate ? new Date(startDate as string) : undefined;
    const endDateTime = endDate ? new Date(endDate as string) : undefined;

    const result = await microsoftIntegration.getTeamsMeetings(
      organizationId,
      startDateTime,
      endDateTime
    );

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Microsoft not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch meetings');
    }

    res.json({ meetings: result.data });
  })
);

/**
 * POST /integrations/microsoft/test
 * Test Microsoft connection
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await microsoftIntegration.testConnection(organizationId);

    if (!result.success) {
      res.status(result.requiresReconfiguration ? 401 : 400).json({
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      });
      return;
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * DELETE /integrations/microsoft/disconnect
 * Disconnect Microsoft integration
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await microsoftIntegration.disconnect(organizationId);

    if (!success) {
      throw new NotFoundError('Microsoft not connected');
    }

    res.json({ success: true });
  })
);

export default router;
