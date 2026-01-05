/**
 * @ownership
 * @domain Custom Vocabulary Management
 * @description HTTP handlers for custom vocabulary CRUD operations
 * @single-responsibility YES — vocabulary HTTP request handling
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware';
import { customVocabularyRepository } from '@zigznote/database';
import { z, ZodError } from 'zod';
import { ValidationError, NotFoundError } from '@zigznote/shared';

/**
 * Convert Zod errors to ValidationError format
 */
function zodToValidationErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((e) => ({
    field: e.path.join('.') || 'root',
    message: e.message,
  }));
}

/**
 * Vocabulary categories
 */
const VOCABULARY_CATEGORIES = [
  'product',
  'company',
  'person',
  'technical',
  'industry',
  'other',
] as const;

/**
 * Validation schemas
 */
const createVocabularySchema = z.object({
  term: z.string().min(1).max(100),
  boost: z.number().min(1).max(2).optional().default(1.5),
  category: z.enum(VOCABULARY_CATEGORIES).optional().nullable(),
});

const updateVocabularySchema = z.object({
  term: z.string().min(1).max(100).optional(),
  boost: z.number().min(1).max(2).optional(),
  category: z.enum(VOCABULARY_CATEGORIES).optional().nullable(),
});

const bulkCreateSchema = z.object({
  terms: z.array(createVocabularySchema).min(1).max(500),
});

/**
 * Custom vocabulary controller
 */
class VocabularyController {
  /**
   * List all vocabulary terms for the organization
   * GET /api/v1/vocabulary
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId!;
      const { category } = req.query;

      let terms;
      if (category && typeof category === 'string') {
        terms = await customVocabularyRepository.findByCategory(
          organizationId,
          category
        );
      } else {
        terms = await customVocabularyRepository.findByOrganization(
          organizationId
        );
      }

      res.json({
        data: terms,
        total: terms.length,
        categories: VOCABULARY_CATEGORIES,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single vocabulary term by ID
   * GET /api/v1/vocabulary/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = req.params.id!;
      const organizationId = authReq.auth!.organizationId!;

      const term = await customVocabularyRepository.findById(id);

      if (!term || term.organizationId !== organizationId) {
        throw new NotFoundError('Vocabulary term not found');
      }

      res.json(term);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new vocabulary term
   * POST /api/v1/vocabulary
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId!;

      const validation = createVocabularySchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(zodToValidationErrors(validation.error));
      }

      const term = await customVocabularyRepository.upsert({
        organizationId,
        ...validation.data,
      });

      res.status(201).json(term);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk create vocabulary terms
   * POST /api/v1/vocabulary/bulk
   */
  async bulkCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId!;

      const validation = bulkCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(zodToValidationErrors(validation.error));
      }

      const termsWithOrg = validation.data.terms.map((t) => ({
        ...t,
        organizationId,
      }));

      const terms = await customVocabularyRepository.bulkCreate(termsWithOrg);

      res.json({
        data: terms,
        total: terms.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a vocabulary term
   * PATCH /api/v1/vocabulary/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = req.params.id!;
      const organizationId = authReq.auth!.organizationId!;

      // Verify ownership
      const existing = await customVocabularyRepository.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundError('Vocabulary term not found');
      }

      const validation = updateVocabularySchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(zodToValidationErrors(validation.error));
      }

      const term = await customVocabularyRepository.update(id, validation.data);

      res.json(term);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a vocabulary term
   * DELETE /api/v1/vocabulary/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = req.params.id!;
      const organizationId = authReq.auth!.organizationId!;

      // Verify ownership
      const existing = await customVocabularyRepository.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundError('Vocabulary term not found');
      }

      await customVocabularyRepository.delete(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vocabulary stats
   * GET /api/v1/vocabulary/stats
   */
  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const organizationId = authReq.auth!.organizationId!;

      const total = await customVocabularyRepository.count(organizationId);
      const terms = await customVocabularyRepository.findByOrganization(
        organizationId
      );

      // Group by category
      const byCategory: Record<string, number> = {};
      for (const term of terms) {
        const cat = term.category || 'uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }

      res.json({
        total,
        byCategory,
        limit: 500, // Max terms per organization
        remaining: Math.max(0, 500 - total),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vocabularyController = new VocabularyController();
