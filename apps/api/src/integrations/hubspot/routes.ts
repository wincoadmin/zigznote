/**
 * HubSpot Integration Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { HubSpotIntegration } from './HubSpotIntegration';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';

const router = Router();
const prisma = new PrismaClient();
const hubspotIntegration = new HubSpotIntegration(prisma);

/**
 * GET /integrations/hubspot/connect
 * Initiate HubSpot OAuth flow
 */
router.get(
  '/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Generate state with organization ID for callback
    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        nonce: crypto.randomBytes(16).toString('hex'),
      })
    ).toString('base64');

    const authUrl = hubspotIntegration.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  })
);

/**
 * GET /integrations/hubspot/callback
 * Handle HubSpot OAuth callback
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
    const tokenResult = await hubspotIntegration.exchangeCodeForTokens(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'OAuth failed')}`
      );
    }

    // Save connection
    await hubspotIntegration.saveHubSpotConnection(
      stateData.organizationId,
      tokenResult.data.accessToken,
      tokenResult.data.refreshToken || '',
      tokenResult.data.expiresIn || 21600 // Default 6 hours
    );

    // Redirect to settings page with success
    res.redirect(`${config.webUrl}/settings/integrations?hubspot=connected`);
  })
);

/**
 * GET /integrations/hubspot/status
 * Get HubSpot connection status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const connection = await hubspotIntegration.getConnection(organizationId);

    if (!connection) {
      return res.json({ connected: false });
    }

    res.json({
      connected: connection.status === 'connected',
      status: connection.status,
      portalId: connection.credentials.portalId,
      hubDomain: connection.credentials.hubDomain,
      settings: connection.settings,
      connectedAt: connection.connectedAt,
    });
  })
);

/**
 * POST /integrations/hubspot/test
 * Test HubSpot connection
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await hubspotIntegration.testConnection(organizationId);

    if (!result.success) {
      return res.status(result.requiresReconfiguration ? 401 : 400).json({
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      });
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * PUT /integrations/hubspot/settings
 * Update HubSpot settings
 */
router.put(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const { autoSync, createTasks, logMeetings, enabled } = req.body;

    const connection = await hubspotIntegration.updateSettings(organizationId, {
      autoSync,
      createTasks,
      logMeetings,
      enabled,
    });

    if (!connection) {
      throw new NotFoundError('HubSpot not connected');
    }

    res.json({ success: true, settings: connection.settings });
  })
);

/**
 * GET /integrations/hubspot/contacts/search
 * Search HubSpot contacts
 */
router.get(
  '/contacts/search',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { emails } = req.query;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    if (!emails || typeof emails !== 'string') {
      throw new BadRequestError('Emails parameter required');
    }

    const emailList = emails.split(',').map((e) => e.trim());
    const result = await hubspotIntegration.searchContacts(organizationId, emailList);

    if (!result.success) {
      throw new BadRequestError(result.error || 'Failed to search contacts');
    }

    res.json({ contacts: result.data });
  })
);

/**
 * POST /integrations/hubspot/sync/:meetingId
 * Sync meeting to HubSpot
 */
router.post(
  '/sync/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { meetingId } = req.params;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Fetch meeting with summary and action items
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        organizationId,
      },
      include: {
        summary: true,
        actionItems: true,
        participants: true,
      },
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    if (!meeting.summary) {
      throw new BadRequestError('Meeting has no summary');
    }

    const summaryContent = meeting.summary.content as {
      executiveSummary: string;
      topics: Array<{ title: string; summary: string }>;
      decisions: string[];
    };

    const result = await hubspotIntegration.sendMeetingSummary(organizationId, {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime || new Date(),
      endTime: meeting.endTime || undefined,
      duration: meeting.durationSeconds || undefined,
      participants: meeting.participants.map((p) => ({
        name: p.name,
        email: p.email || undefined,
      })),
      summary: {
        executiveSummary: summaryContent.executiveSummary,
        topics: summaryContent.topics || [],
        decisions: summaryContent.decisions || [],
      },
      actionItems: meeting.actionItems.map((item) => ({
        text: item.text,
        assignee: item.assignee || undefined,
        dueDate: item.dueDate?.toISOString().split('T')[0],
      })),
      transcriptUrl: `${config.webUrl}/meetings/${meeting.id}`,
    });

    if (!result.success) {
      throw new BadRequestError(result.error || 'Failed to sync to HubSpot');
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * DELETE /integrations/hubspot/disconnect
 * Disconnect HubSpot integration
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await hubspotIntegration.disconnect(organizationId);

    if (!success) {
      throw new NotFoundError('HubSpot not connected');
    }

    res.json({ success: true });
  })
);

export default router;
