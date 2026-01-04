import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MeetingService } from '../services/meetingService';
import { errors } from '../utils/errors';

const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  platform: z.enum(['zoom', 'meet', 'teams', 'webex', 'other']).optional(),
  meetingUrl: z.string().url().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

const listMeetingsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['scheduled', 'recording', 'processing', 'completed']).optional(),
});

/**
 * Controller for meeting-related HTTP endpoints
 * Handles request validation and delegates to MeetingService
 */
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  /**
   * List meetings with pagination
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listMeetingsSchema.parse(req.query);
      const result = await this.meetingService.list(query);

      res.json({
        success: true,
        data: result.meetings,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a meeting by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      const meeting = await this.meetingService.getById(id);
      if (!meeting) {
        throw errors.notFound('Meeting');
      }

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
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createMeetingSchema.parse(req.body);
      const meeting = await this.meetingService.create(data);

      res.status(201).json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a meeting
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('Meeting ID is required');
      }

      await this.meetingService.delete(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
