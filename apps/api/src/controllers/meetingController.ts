/**
 * Meeting controller for handling HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { meetingService } from '../services/meetingService';
import { recallService } from '../services/recallService';
import { errors } from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware';
import { meetingRepository } from '@zigznote/database';

/**
 * Validation schemas for meeting endpoints
 */
const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  platform: z.enum(['zoom', 'meet', 'teams', 'webex', 'other']).optional(),
  meetingUrl: z.string().url().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
});

const updateMeetingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  platform: z.enum(['zoom', 'meet', 'teams', 'webex', 'other']).optional(),
  meetingUrl: z.string().url().optional(),
  recordingUrl: z.string().url().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  status: z.enum(['scheduled', 'recording', 'processing', 'completed', 'failed']).optional(),
});

const listMeetingsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .union([
      z.enum(['scheduled', 'recording', 'processing', 'completed', 'failed']),
      z.array(z.enum(['scheduled', 'recording', 'processing', 'completed', 'failed'])),
    ])
    .optional(),
  platform: z.enum(['zoom', 'meet', 'teams', 'webex', 'other']).optional(),
  search: z.string().optional(),
  startTimeFrom: z.coerce.date().optional(),
  startTimeTo: z.coerce.date().optional(),
});

/**
 * Controller for meeting-related HTTP endpoints
 */
export class MeetingController {
  /**
   * List meetings with pagination and filtering
   * GET /api/v1/meetings
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = listMeetingsSchema.parse(req.query);
      const organizationId = authReq.auth!.organizationId;

      const result = await meetingService.list({
        organizationId,
        ...query,
      });

      res.json({
        success: true,
        data: result.meetings,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming meetings
   * GET /api/v1/meetings/upcoming
   */
  async getUpcoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const meetings = await meetingService.getUpcoming(organizationId, limit);

      res.json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent completed meetings
   * GET /api/v1/meetings/recent
   */
  async getRecent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const meetings = await meetingService.getRecentCompleted(organizationId, limit);

      res.json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get meeting statistics
   * GET /api/v1/meetings/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;
      const stats = await meetingService.getStats(organizationId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a meeting by ID
   * GET /api/v1/meetings/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      const meeting = await meetingService.getById(id, organizationId);

      res.json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new meeting
   * POST /api/v1/meetings
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const data = createMeetingSchema.parse(req.body);
      const organizationId = authReq.auth!.organizationId;
      const createdById = authReq.auth!.userId;

      const meeting = await meetingService.create({
        organizationId,
        createdById,
        ...data,
      });

      res.status(201).json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a meeting
   * PUT /api/v1/meetings/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const data = updateMeetingSchema.parse(req.body);
      const organizationId = authReq.auth!.organizationId;

      const meeting = await meetingService.update(id, organizationId, data);

      res.json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a meeting
   * DELETE /api/v1/meetings/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      await meetingService.delete(id, organizationId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transcript for a meeting
   * GET /api/v1/meetings/:id/transcript
   */
  async getTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      const transcript = await meetingService.getTranscript(id, organizationId);

      if (!transcript) {
        throw errors.notFound('Transcript');
      }

      res.json({
        success: true,
        data: transcript,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get summary for a meeting
   * GET /api/v1/meetings/:id/summary
   */
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      const summary = await meetingService.getSummary(id, organizationId);

      if (!summary) {
        throw errors.notFound('Summary');
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get action items for a meeting
   * GET /api/v1/meetings/:id/action-items
   */
  async getActionItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      const actionItems = await meetingService.getActionItems(id, organizationId);

      res.json({
        success: true,
        data: actionItems,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create and send a bot to join a meeting
   * POST /api/v1/meetings/:id/bot
   */
  async createBot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      // Get the meeting and verify ownership
      const meeting = await meetingService.getById(id, organizationId);

      if (!meeting.meetingUrl) {
        throw errors.badRequest('Meeting URL is required to send a bot');
      }

      // Check if bot already exists for this meeting
      if (meeting.botId) {
        const existingStatus = await recallService.getBotStatus(meeting.botId);
        if (existingStatus.status !== 'ended' && existingStatus.status !== 'error') {
          res.json({
            success: true,
            data: {
              botId: meeting.botId,
              status: existingStatus.status,
              message: 'Bot already exists for this meeting',
            },
          });
          return;
        }
      }

      // Parse optional body params
      const { botName, joinAt } = req.body || {};

      // Create the bot
      const botStatus = await recallService.createBot({
        meetingId: id,
        organizationId,
        meetingUrl: meeting.meetingUrl,
        botName: botName || undefined,
        joinAt: joinAt ? new Date(joinAt) : undefined,
      });

      // Update meeting with bot ID
      await meetingRepository.update(id, { botId: botStatus.id });

      res.status(201).json({
        success: true,
        data: {
          botId: botStatus.id,
          status: botStatus.status,
          meetingUrl: meeting.meetingUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bot status for a meeting
   * GET /api/v1/meetings/:id/bot
   */
  async getBotStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      // Get the meeting and verify ownership
      const meeting = await meetingService.getById(id, organizationId);

      if (!meeting.botId) {
        throw errors.notFound('Bot not found for this meeting');
      }

      // Get bot status from Recall.ai
      const botStatus = await recallService.getBotStatus(meeting.botId);

      // Get recording info if available
      let recording = null;
      if (botStatus.recordingAvailable) {
        recording = await recallService.getRecording(meeting.botId);
      }

      res.json({
        success: true,
        data: {
          botId: meeting.botId,
          status: botStatus.status,
          joinedAt: botStatus.joinedAt,
          leftAt: botStatus.leftAt,
          errorMessage: botStatus.errorMessage,
          recording,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Stop and remove bot from a meeting
   * DELETE /api/v1/meetings/:id/bot
   */
  async stopBot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      // Get the meeting and verify ownership
      const meeting = await meetingService.getById(id, organizationId);

      if (!meeting.botId) {
        throw errors.notFound('Bot not found for this meeting');
      }

      // Stop the bot
      await recallService.stopBot(meeting.botId);

      res.json({
        success: true,
        data: {
          message: 'Bot stopped successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Regenerate summary for a meeting
   * POST /api/v1/meetings/:id/summary/regenerate
   */
  async regenerateSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;
      const { forceModel } = req.body || {};

      // Validate forceModel if provided
      if (forceModel && forceModel !== 'claude' && forceModel !== 'gpt') {
        throw errors.badRequest('forceModel must be "claude" or "gpt"');
      }

      const result = await meetingService.regenerateSummary(id, organizationId, {
        forceModel,
      });

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an action item
   * PATCH /api/v1/meetings/:id/action-items/:actionItemId
   */
  async updateActionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id, actionItemId } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }
      if (!actionItemId) {
        throw errors.badRequest('Action item ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      // Validate and parse update data
      const updateSchema = z.object({
        text: z.string().min(1).optional(),
        assignee: z.string().optional(),
        dueDate: z.coerce.date().optional(),
        completed: z.boolean().optional(),
      });

      const data = updateSchema.parse(req.body);

      const updated = await meetingService.updateActionItem(id, actionItemId, organizationId, data);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an action item
   * DELETE /api/v1/meetings/:id/action-items/:actionItemId
   */
  async deleteActionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id, actionItemId } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }
      if (!actionItemId) {
        throw errors.badRequest('Action item ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      await meetingService.deleteActionItem(id, actionItemId, organizationId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const meetingController = new MeetingController();
