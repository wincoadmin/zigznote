/**
 * Meeting controller for handling HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { meetingService } from '../services/meetingService';
import { errors } from '../utils/errors';

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
 * Get organization ID from request
 * In Phase 2, this will come from authenticated user
 * For now, uses header or query param for testing
 */
function getOrganizationId(req: Request): string {
  const orgId =
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string) ||
    'demo-org-id'; // Default for development

  return orgId;
}

/**
 * Get user ID from request
 * In Phase 2, this will come from authenticated user
 */
function getUserId(req: Request): string | undefined {
  return (req.headers['x-user-id'] as string) || undefined;
}

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
      const query = listMeetingsSchema.parse(req.query);
      const organizationId = getOrganizationId(req);

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
      const organizationId = getOrganizationId(req);
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
      const organizationId = getOrganizationId(req);
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
      const organizationId = getOrganizationId(req);
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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = getOrganizationId(req);
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
      const data = createMeetingSchema.parse(req.body);
      const organizationId = getOrganizationId(req);
      const createdById = getUserId(req);

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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const data = updateMeetingSchema.parse(req.body);
      const organizationId = getOrganizationId(req);

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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = getOrganizationId(req);
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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = getOrganizationId(req);
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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = getOrganizationId(req);
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
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = getOrganizationId(req);
      const actionItems = await meetingService.getActionItems(id, organizationId);

      res.json({
        success: true,
        data: actionItems,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const meetingController = new MeetingController();
