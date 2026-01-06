/**
 * Meeting routes
 * All routes require authentication (session or API key)
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingController } from '../controllers/meetingController';
import { requireAuth, optionalApiKeyAuth, requireScope } from '../middleware';

export const meetingsRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
meetingsRouter.use(optionalApiKeyAuth);
meetingsRouter.use(requireAuth);

/**
 * @openapi
 * /api/v1/meetings:
 *   get:
 *     summary: List meetings
 *     description: Get paginated list of meetings for the authenticated user's organization
 *     tags: [Meetings]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, pending, joining, recording, processing, completed, failed, cancelled]
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [zoom, meet, teams, webex, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in meeting titles
 *     responses:
 *       200:
 *         description: List of meetings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meetings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meeting'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
meetingsRouter.get(
  '/',
  requireScope('meetings:read'),
  meetingController.list.bind(meetingController)
);

/**
 * @route GET /api/v1/meetings/upcoming
 * @description Get upcoming scheduled meetings
 * @query {number} limit - Maximum number to return (default: 10)
 */
meetingsRouter.get(
  '/upcoming',
  requireScope('meetings:read'),
  meetingController.getUpcoming.bind(meetingController)
);

/**
 * @route GET /api/v1/meetings/recent
 * @description Get recent completed meetings
 * @query {number} limit - Maximum number to return (default: 10)
 */
meetingsRouter.get(
  '/recent',
  requireScope('meetings:read'),
  meetingController.getRecent.bind(meetingController)
);

/**
 * @route GET /api/v1/meetings/stats
 * @description Get meeting statistics for the organization
 */
meetingsRouter.get(
  '/stats',
  requireScope('meetings:read'),
  meetingController.getStats.bind(meetingController)
);

/**
 * @openapi
 * /api/v1/meetings/{id}:
 *   get:
 *     summary: Get meeting details
 *     description: Get detailed information about a specific meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Meeting details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meeting:
 *                   $ref: '#/components/schemas/Meeting'
 *       404:
 *         description: Meeting not found
 */
meetingsRouter.get(
  '/:id',
  requireScope('meetings:read'),
  meetingController.getById.bind(meetingController)
);

/**
 * @openapi
 * /api/v1/meetings:
 *   post:
 *     summary: Create a meeting
 *     description: Create a new meeting and optionally start the recording bot
 *     tags: [Meetings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Meeting title
 *               platform:
 *                 type: string
 *                 enum: [zoom, meet, teams, webex, other]
 *               meetingUrl:
 *                 type: string
 *                 format: uri
 *                 description: Meeting URL (Zoom, Meet, Teams)
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Meeting created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meeting:
 *                   $ref: '#/components/schemas/Meeting'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
meetingsRouter.post(
  '/',
  requireScope('meetings:write'),
  meetingController.create.bind(meetingController)
);

/**
 * @route PUT /api/v1/meetings/:id
 * @description Update a meeting
 */
meetingsRouter.put(
  '/:id',
  requireScope('meetings:write'),
  meetingController.update.bind(meetingController)
);

/**
 * @route DELETE /api/v1/meetings/:id
 * @description Delete a meeting (soft delete)
 */
meetingsRouter.delete(
  '/:id',
  requireScope('meetings:write'),
  meetingController.delete.bind(meetingController)
);

/**
 * @openapi
 * /api/v1/meetings/{id}/transcript:
 *   get:
 *     summary: Get meeting transcript
 *     description: Get the full transcript for a meeting
 *     tags: [Transcripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Meeting transcript
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transcript:
 *                   $ref: '#/components/schemas/Transcript'
 *       404:
 *         description: Transcript not found
 */
meetingsRouter.get(
  '/:id/transcript',
  requireScope('transcripts:read'),
  meetingController.getTranscript.bind(meetingController)
);

/**
 * @openapi
 * /api/v1/meetings/{id}/summary:
 *   get:
 *     summary: Get meeting summary
 *     description: Get the AI-generated summary for a meeting
 *     tags: [Summaries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Meeting summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   $ref: '#/components/schemas/Summary'
 *       404:
 *         description: Summary not found
 */
meetingsRouter.get(
  '/:id/summary',
  requireScope('transcripts:read'),
  meetingController.getSummary.bind(meetingController)
);

/**
 * @route GET /api/v1/meetings/:id/action-items
 * @description Get action items extracted from a meeting
 */
meetingsRouter.get(
  '/:id/action-items',
  requireScope('action-items:read'),
  meetingController.getActionItems.bind(meetingController)
);

/**
 * @route PATCH /api/v1/meetings/:id/action-items/:actionItemId
 * @description Update an action item (mark complete, change assignee, etc.)
 * @body {string} text - Action item text
 * @body {string} assignee - Person responsible
 * @body {Date} dueDate - Due date
 * @body {boolean} completed - Completion status
 */
meetingsRouter.patch(
  '/:id/action-items/:actionItemId',
  requireScope('action-items:write'),
  meetingController.updateActionItem.bind(meetingController)
);

/**
 * @route DELETE /api/v1/meetings/:id/action-items/:actionItemId
 * @description Delete an action item
 */
meetingsRouter.delete(
  '/:id/action-items/:actionItemId',
  requireScope('action-items:write'),
  meetingController.deleteActionItem.bind(meetingController)
);

/**
 * @route POST /api/v1/meetings/:id/summary/regenerate
 * @description Regenerate the AI summary for a meeting
 * @body {string} forceModel - Optional: "claude" or "gpt" to force a specific model
 */
meetingsRouter.post(
  '/:id/summary/regenerate',
  requireScope('transcripts:write'),
  meetingController.regenerateSummary.bind(meetingController)
);

/**
 * @route POST /api/v1/meetings/:id/insights
 * @description Extract custom insights from a meeting
 * @body {string} templateId - ID of the insight template to use
 * @body {string} forceModel - Optional: "claude" or "gpt" to force a specific model
 */
import { insightsController } from '../controllers/insightsController';
meetingsRouter.post(
  '/:id/insights',
  requireScope('meetings:read'),
  insightsController.extractInsights.bind(insightsController)
);

/**
 * @route POST /api/v1/meetings/:id/bot
 * @description Create and send a bot to join the meeting
 * @body {string} botName - Optional custom bot name
 * @body {Date} joinAt - Optional scheduled join time
 */
meetingsRouter.post(
  '/:id/bot',
  requireScope('meetings:write'),
  meetingController.createBot.bind(meetingController)
);

/**
 * @route GET /api/v1/meetings/:id/bot
 * @description Get the bot status for a meeting
 */
meetingsRouter.get(
  '/:id/bot',
  requireScope('meetings:read'),
  meetingController.getBotStatus.bind(meetingController)
);

/**
 * @route DELETE /api/v1/meetings/:id/bot
 * @description Stop and remove the bot from a meeting
 */
meetingsRouter.delete(
  '/:id/bot',
  requireScope('meetings:write'),
  meetingController.stopBot.bind(meetingController)
);
