/**
 * Salesforce Integration Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';
import { SalesforceIntegration } from './SalesforceIntegration';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';

const router: Router = Router();
const salesforceIntegration = new SalesforceIntegration(prisma);

/**
 * GET /integrations/salesforce/connect
 * Initiate Salesforce OAuth flow
 */
router.get(
  '/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Check if Salesforce is configured
    if (!config.salesforce?.clientId || !config.salesforce?.clientSecret) {
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

    const authUrl = salesforceIntegration.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  })
);

/**
 * GET /integrations/salesforce/callback
 * Handle Salesforce OAuth callback
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
    const tokenResult = await salesforceIntegration.exchangeCodeForTokens(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'OAuth failed')}`
      );
    }

    // Temporarily save connection to get user info
    const tempCredentials = {
      accessToken: tokenResult.data.accessToken,
      refreshToken: tokenResult.data.refreshToken,
      instanceUrl: tokenResult.data.instance_url,
    };

    await salesforceIntegration['saveConnection'](stateData.organizationId, tempCredentials, {});

    // Get user info
    const userResult = await salesforceIntegration.getCurrentUser(stateData.organizationId);

    if (!userResult.success || !userResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent('Failed to get user info')}`
      );
    }

    // Save full connection with user info
    await salesforceIntegration.saveSalesforceConnection(
      stateData.organizationId,
      tokenResult.data,
      userResult.data
    );

    // Redirect to settings page with success
    res.redirect(`${config.webUrl}/settings/integrations?salesforce=connected`);
  })
);

/**
 * GET /integrations/salesforce/status
 * Get Salesforce connection status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const connection = await salesforceIntegration.getConnection(organizationId);

    if (!connection) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: connection.status === 'connected',
      status: connection.status,
      email: connection.credentials.email,
      userName: connection.settings.userName,
      instanceUrl: connection.credentials.instanceUrl,
      settings: {
        logMeetingsToContacts: connection.settings.logMeetingsToContacts,
        createTasksFromActionItems: connection.settings.createTasksFromActionItems,
      },
      connectedAt: connection.connectedAt,
    });
  })
);

/**
 * PUT /integrations/salesforce/settings
 * Update Salesforce settings
 */
router.put(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const { logMeetingsToContacts, createTasksFromActionItems, enabled } = req.body;

    const connection = await salesforceIntegration.updateSettings(organizationId, {
      logMeetingsToContacts,
      createTasksFromActionItems,
      enabled,
    });

    if (!connection) {
      throw new NotFoundError('Salesforce not connected');
    }

    res.json({ success: true, settings: connection.settings });
  })
);

/**
 * GET /integrations/salesforce/contacts
 * Search contacts by email
 */
router.get(
  '/contacts',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { emails } = req.query;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    if (!emails) {
      res.json({ contacts: [] });
      return;
    }

    const emailList = (emails as string).split(',').map((e) => e.trim());

    const result = await salesforceIntegration.findContactsByEmail(organizationId, emailList);

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Salesforce not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch contacts');
    }

    res.json({ contacts: result.data });
  })
);

/**
 * POST /integrations/salesforce/log-meeting/:meetingId
 * Log meeting to Salesforce
 */
router.post(
  '/log-meeting/:meetingId',
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

    const result = await salesforceIntegration.logMeeting(organizationId, {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime || new Date(),
      endTime: meeting.endTime || undefined,
      duration: meeting.durationSeconds || undefined,
      participants: meeting.participants.map((p) => ({ name: p.name, email: p.email || undefined })),
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
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Salesforce not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to log meeting');
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * POST /integrations/salesforce/test
 * Test Salesforce connection
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await salesforceIntegration.testConnection(organizationId);

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
 * DELETE /integrations/salesforce/disconnect
 * Disconnect Salesforce integration
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await salesforceIntegration.disconnect(organizationId);

    if (!success) {
      throw new NotFoundError('Salesforce not connected');
    }

    res.json({ success: true });
  })
);

export default router;
