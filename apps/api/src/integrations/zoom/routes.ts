/**
 * Zoom Integration Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';
import { ZoomIntegration } from './ZoomIntegration';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';

const router: Router = Router();
const zoomIntegration = new ZoomIntegration(prisma);

/**
 * GET /integrations/zoom/connect
 * Initiate Zoom OAuth flow
 */
router.get(
  '/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Check if Zoom is configured
    if (!config.zoom?.clientId || !config.zoom?.clientSecret) {
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

    const authUrl = zoomIntegration.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  })
);

/**
 * GET /integrations/zoom/callback
 * Handle Zoom OAuth callback
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.webUrl}/settings/integrations?error=${error}`);
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
    const tokenResult = await zoomIntegration.exchangeCodeForTokens(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'OAuth failed')}`
      );
    }

    // Get user info - need to temporarily save tokens to make authenticated request
    const tempCredentials = {
      accessToken: tokenResult.data.accessToken,
      refreshToken: tokenResult.data.refreshToken,
      tokenExpires: tokenResult.data.expiresIn
        ? new Date(Date.now() + tokenResult.data.expiresIn * 1000)
        : undefined,
    };

    // Save temporary connection to get user info
    await zoomIntegration['saveConnection'](stateData.organizationId, tempCredentials, {});

    const userResult = await zoomIntegration.getCurrentUser(stateData.organizationId);

    if (!userResult.success || !userResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent('Failed to get user info')}`
      );
    }

    // Save full connection with user info
    await zoomIntegration.saveZoomConnection(
      stateData.organizationId,
      tokenResult.data,
      userResult.data
    );

    // Redirect to settings page with success
    res.redirect(`${config.webUrl}/settings/integrations?zoom=connected`);
  })
);

/**
 * GET /integrations/zoom/status
 * Get Zoom connection status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const connection = await zoomIntegration.getConnection(organizationId);

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
 * GET /integrations/zoom/meetings
 * Get upcoming Zoom meetings
 */
router.get(
  '/meetings',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await zoomIntegration.getUpcomingMeetings(organizationId);

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Zoom not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch meetings');
    }

    res.json({ meetings: result.data });
  })
);

/**
 * GET /integrations/zoom/meetings/:meetingId
 * Get specific Zoom meeting details
 */
router.get(
  '/meetings/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { meetingId } = req.params;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    if (!meetingId) {
      throw new BadRequestError('Meeting ID required');
    }

    const result = await zoomIntegration.getMeetingDetails(organizationId, meetingId);

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Zoom not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch meeting');
    }

    res.json({ meeting: result.data });
  })
);

/**
 * POST /integrations/zoom/test
 * Test Zoom connection
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await zoomIntegration.testConnection(organizationId);

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
 * DELETE /integrations/zoom/disconnect
 * Disconnect Zoom integration
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await zoomIntegration.disconnect(organizationId);

    if (!success) {
      throw new NotFoundError('Zoom not connected');
    }

    res.json({ success: true });
  })
);

export default router;
