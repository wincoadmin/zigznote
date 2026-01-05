/**
 * Slack Integration Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';
import { SlackIntegration } from './SlackIntegration';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';

const router: Router = Router();
const slackIntegration = new SlackIntegration(prisma);

/**
 * GET /integrations/slack/connect
 * Initiate Slack OAuth flow
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

    const authUrl = slackIntegration.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  })
);

/**
 * GET /integrations/slack/callback
 * Handle Slack OAuth callback
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      // Redirect to frontend with error
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
    const tokenResult = await slackIntegration.exchangeCodeForTokens(code as string);

    if (!tokenResult.success || !tokenResult.data) {
      return res.redirect(
        `${config.webUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'OAuth failed')}`
      );
    }

    // Save connection
    await slackIntegration.saveSlackConnection(stateData.organizationId, tokenResult.data);

    // Redirect to settings page with success
    res.redirect(`${config.webUrl}/settings/integrations?slack=connected`);
  })
);

/**
 * GET /integrations/slack/status
 * Get Slack connection status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const connection = await slackIntegration.getConnection(organizationId);

    if (!connection) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: connection.status === 'connected',
      status: connection.status,
      teamName: connection.credentials.teamName,
      settings: connection.settings,
      connectedAt: connection.connectedAt,
    });
  })
);

/**
 * GET /integrations/slack/channels
 * Get available Slack channels
 */
router.get(
  '/channels',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await slackIntegration.getChannels(organizationId);

    if (!result.success) {
      if (result.requiresReconfiguration) {
        throw new NotFoundError('Slack not connected or token expired');
      }
      throw new BadRequestError(result.error || 'Failed to fetch channels');
    }

    res.json({ channels: result.data });
  })
);

/**
 * POST /integrations/slack/test
 * Test Slack connection
 */
router.post(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const result = await slackIntegration.testConnection(organizationId);

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
 * PUT /integrations/slack/settings
 * Update Slack settings
 */
router.put(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const { defaultChannel, autoSend, enabled } = req.body;

    const connection = await slackIntegration.updateSettings(organizationId, {
      defaultChannel,
      autoSend,
      enabled,
    });

    if (!connection) {
      throw new NotFoundError('Slack not connected');
    }

    res.json({ success: true, settings: connection.settings });
  })
);

/**
 * POST /integrations/slack/send/:meetingId
 * Send meeting summary to Slack
 */
router.post(
  '/send/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { meetingId } = req.params;
    const { channelId } = req.body;

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

    const result = await slackIntegration.sendMeetingSummary(
      organizationId,
      {
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
      },
      { channelId }
    );

    if (!result.success) {
      throw new BadRequestError(result.error || 'Failed to send to Slack');
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * DELETE /integrations/slack/disconnect
 * Disconnect Slack integration
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await slackIntegration.disconnect(organizationId);

    if (!success) {
      throw new NotFoundError('Slack not connected');
    }

    res.json({ success: true });
  })
);

export default router;
