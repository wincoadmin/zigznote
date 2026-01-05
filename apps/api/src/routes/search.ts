/**
 * Search API routes
 * Unified search across meetings, transcripts, summaries, and action items
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { searchService } from '../services/searchService';
import { embeddingService } from '../services/embeddingService';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, validateRequest } from '../middleware';

export const searchRouter: IRouter = Router();

// All search routes require authentication
searchRouter.use(requireAuth);

// Validation schemas
const searchSchema = {
  query: z.object({
    q: z.string().min(1).max(500),
    types: z.string().optional(), // comma-separated: meeting,transcript,summary,action_item
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  }),
};

const suggestionsSchema = {
  query: z.object({
    q: z.string().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5).optional(),
  }),
};

/**
 * @route GET /api/search
 * @description Search across all content types
 */
searchRouter.get(
  '/',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as unknown as z.infer<typeof searchSchema.query>;
    const { q, types, startDate, endDate, limit, offset } = query;

    // Parse types
    const searchTypes = types
      ? (types.split(',') as ('meeting' | 'transcript' | 'summary' | 'action_item')[])
      : ['meeting', 'transcript', 'summary', 'action_item'] as const;

    // Validate types
    const validTypes = ['meeting', 'transcript', 'summary', 'action_item'];
    const filteredTypes = searchTypes.filter((t) =>
      validTypes.includes(t)
    ) as ('meeting' | 'transcript' | 'summary' | 'action_item')[];

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
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
    const query = req.query as unknown as z.infer<typeof searchSchema.query>;
    const { q, startDate, endDate, limit, offset } = query;

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth!.organizationId,
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
    const query = req.query as unknown as z.infer<typeof searchSchema.query>;
    const { q, startDate, endDate, limit, offset } = query;

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth!.organizationId,
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
    const query = req.query as unknown as z.infer<typeof searchSchema.query>;
    const { q, startDate, endDate, limit, offset } = query;

    const result = await searchService.search({
      query: q,
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
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
    const query = req.query as unknown as z.infer<typeof suggestionsSchema.query>;
    const { q, limit } = query;

    const suggestions = await searchService.getSuggestions(
      q,
      authReq.auth!.organizationId,
      limit
    );

    res.json({
      success: true,
      data: suggestions,
    });
  })
);

const semanticSearchSchema = {
  query: z.object({
    q: z.string().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
    threshold: z.coerce.number().min(0).max(1).default(0.7).optional(),
  }),
};

/**
 * @route GET /api/search/semantic
 * @description Semantic search using vector embeddings
 */
searchRouter.get(
  '/semantic',
  validateRequest(semanticSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as unknown as z.infer<typeof semanticSearchSchema.query>;
    const { q, limit, threshold } = query;

    if (!embeddingService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Semantic search is not available',
        },
      });
      return;
    }

    const results = await embeddingService.searchSimilar({
      query: q,
      organizationId: authReq.auth!.organizationId,
      limit,
      threshold,
    });

    res.json({
      success: true,
      data: results,
      meta: {
        query: q,
        total: results.length,
      },
    });
  })
);

/**
 * @route GET /api/search/hybrid
 * @description Hybrid search combining full-text and semantic search
 */
searchRouter.get(
  '/hybrid',
  validateRequest(semanticSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as unknown as z.infer<typeof semanticSearchSchema.query>;
    const { q, limit } = query;

    // Get both full-text and semantic results
    const [textResults, semanticResults] = await Promise.all([
      searchService.search({
        query: q,
        organizationId: authReq.auth!.organizationId,
        types: ['transcript', 'summary'],
        limit: limit ? limit * 2 : 20,
      }),
      embeddingService.isAvailable()
        ? embeddingService.hybridSearch({
            query: q,
            organizationId: authReq.auth!.organizationId,
            limit: limit ? limit * 2 : 20,
          })
        : Promise.resolve([]),
    ]);

    // Combine and dedupe results
    const combinedMeetingIds = new Set<string>();
    const combinedResults: Array<{
      meetingId: string;
      meetingTitle: string;
      preview: string;
      source: 'text' | 'semantic' | 'both';
      score: number;
    }> = [];

    // Add semantic results
    for (const result of semanticResults) {
      combinedMeetingIds.add(result.meetingId);
      combinedResults.push({
        meetingId: result.meetingId,
        meetingTitle: result.meetingTitle,
        preview: result.chunkText.substring(0, 200) + '...',
        source: 'semantic',
        score: result.similarity,
      });
    }

    // Add text results that aren't already included
    for (const result of textResults.results) {
      if (!combinedMeetingIds.has(result.meetingId)) {
        combinedMeetingIds.add(result.meetingId);
        combinedResults.push({
          meetingId: result.meetingId,
          meetingTitle: result.meetingTitle || result.title,
          preview: result.preview,
          source: 'text',
          score: result.score,
        });
      } else {
        // Mark existing result as from both sources
        const existing = combinedResults.find(r => r.meetingId === result.meetingId);
        if (existing) {
          existing.source = 'both';
          existing.score = Math.max(existing.score, result.score);
        }
      }
    }

    // Sort by score
    combinedResults.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: combinedResults.slice(0, limit || 10),
      meta: {
        query: q,
        total: combinedResults.length,
        semanticAvailable: embeddingService.isAvailable(),
      },
    });
  })
);
