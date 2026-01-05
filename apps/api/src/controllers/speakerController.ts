/**
 * @ownership
 * @domain Speaker Alias Management
 * @description HTTP handlers for speaker alias CRUD operations
 * @single-responsibility YES — speaker alias HTTP request handling
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware';
import { speakerAliasRepository } from '@zigznote/database';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@zigznote/shared';

/**
 * Validation schemas
 */
const createSpeakerAliasSchema = z.object({
  speakerLabel: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  meetingId: z.string().uuid().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

const updateSpeakerAliasSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

const bulkUpsertSchema = z.object({
  aliases: z.array(createSpeakerAliasSchema).min(1).max(100),
});

/**
 * Speaker alias controller
 */
class SpeakerController {
  /**
   * List all speaker aliases for the organization
   * GET /api/v1/speakers
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;

      const aliases = await speakerAliasRepository.findByOrganization(
        organizationId
      );

      res.json({
        data: aliases,
        total: aliases.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single speaker alias by ID
   * GET /api/v1/speakers/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const organizationId = authReq.auth!.organizationId;

      const alias = await speakerAliasRepository.findById(id);

      if (!alias || alias.organizationId !== organizationId) {
        throw new NotFoundError('Speaker alias not found');
      }

      res.json(alias);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new speaker alias
   * POST /api/v1/speakers
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;

      const validation = createSpeakerAliasSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const alias = await speakerAliasRepository.create({
        organizationId,
        ...validation.data,
      });

      res.status(201).json(alias);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update a speaker alias (upsert)
   * PUT /api/v1/speakers
   */
  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;

      const validation = createSpeakerAliasSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const alias = await speakerAliasRepository.upsert({
        organizationId,
        ...validation.data,
      });

      res.json(alias);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk upsert speaker aliases
   * POST /api/v1/speakers/bulk
   */
  async bulkUpsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId;

      const validation = bulkUpsertSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const aliasesWithOrg = validation.data.aliases.map((a) => ({
        ...a,
        organizationId,
      }));

      const aliases = await speakerAliasRepository.bulkUpsert(aliasesWithOrg);

      res.json({
        data: aliases,
        total: aliases.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a speaker alias
   * PATCH /api/v1/speakers/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const organizationId = authReq.auth!.organizationId;

      // Verify ownership
      const existing = await speakerAliasRepository.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundError('Speaker alias not found');
      }

      const validation = updateSpeakerAliasSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const alias = await speakerAliasRepository.update(id, validation.data);

      res.json(alias);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a speaker alias
   * DELETE /api/v1/speakers/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const organizationId = authReq.auth!.organizationId;

      // Verify ownership
      const existing = await speakerAliasRepository.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundError('Speaker alias not found');
      }

      await speakerAliasRepository.delete(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get speaker aliases for a specific meeting
   * GET /api/v1/meetings/:meetingId/speakers
   */
  async listByMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { meetingId } = req.params;

      const aliases = await speakerAliasRepository.findByMeeting(meetingId);

      res.json({
        data: aliases,
        total: aliases.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const speakerController = new SpeakerController();
