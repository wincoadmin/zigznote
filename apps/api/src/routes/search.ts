/**
 * Search API routes
 * Unified search across meetings, transcripts, summaries, and action items
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { searchService } from '../services/searchService';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, validateRequest } from '../middleware';

export const searchRouter: IRouter = Router();

// All search routes require authentication
searchRouter.use(requireAuth);

// Validation schemas
const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(500),
    types: z.string().optional(), // comma-separated: meeting,transcript,summary,action_item
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  }),
});

const suggestionsSchema = z.object({
  query: z.object({
    q: z.string().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5).optional(),
  }),
});

/**
 * @route GET /api/search
 * @description Search across all content types
 */
searchRouter.get(
  '/',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { q, types, startDate, endDate, limit, offset } =
      req.query as z.infer<typeof searchSchema>['query'];

    // Parse types
    const searchTypes = types
      ? (types.split(',') as ('meeting' | 'transcript' | 'summary' | 'action_item')[])
      : ['meeting', 'transcript', 'summary', 'action_item'];

    // Validate types
    const validTypes = ['meeting', 'transcript', 'summary', 'action_item'];
    const filteredTypes = searchTypes.filter((t) =>
      validTypes.includes(t)
    ) as ('meeting' | 'transcript' | 'summary' | 'action_item')[];

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth.organizationId,
      userId: authReq.auth.userId,
      types: filteredTypes.length > 0 ? filteredTypes : undefined,
      dateRange: {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      },
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result.results,
      meta: {
        query: result.query,
        total: result.total,
        took: result.took,
        limit,
        offset,
      },
    });
  })
);

/**
 * @route GET /api/search/meetings
 * @description Search only meetings
 */
searchRouter.get(
  '/meetings',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { q, startDate, endDate, limit, offset } =
      req.query as z.infer<typeof searchSchema>['query'];

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth.organizationId,
      types: ['meeting'],
      dateRange: {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      },
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result.results,
      meta: {
        query: result.query,
        total: result.total,
        took: result.took,
      },
    });
  })
);

/**
 * @route GET /api/search/transcripts
 * @description Search only transcripts (full-text)
 */
searchRouter.get(
  '/transcripts',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { q, startDate, endDate, limit, offset } =
      req.query as z.infer<typeof searchSchema>['query'];

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth.organizationId,
      types: ['transcript'],
      dateRange: {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      },
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result.results,
      meta: {
        query: result.query,
        total: result.total,
        took: result.took,
      },
    });
  })
);

/**
 * @route GET /api/search/action-items
 * @description Search only action items
 */
searchRouter.get(
  '/action-items',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { q, startDate, endDate, limit, offset } =
      req.query as z.infer<typeof searchSchema>['query'];

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth.organizationId,
      userId: authReq.auth.userId,
      types: ['action_item'],
      dateRange: {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      },
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result.results,
      meta: {
        query: result.query,
        total: result.total,
        took: result.took,
      },
    });
  })
);

/**
 * @route GET /api/search/suggestions
 * @description Get search suggestions/autocomplete
 */
searchRouter.get(
  '/suggestions',
  validateRequest(suggestionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { q, limit } = req.query as z.infer<typeof suggestionsSchema>['query'];

    const suggestions = await searchService.getSuggestions(
      q,
      authReq.auth.organizationId,
      limit
    );

    res.json({
      success: true,
      data: suggestions,
    });
  })
);
