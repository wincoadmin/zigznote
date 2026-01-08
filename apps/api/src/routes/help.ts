/**
 * Help API routes
 * AI-powered help assistant endpoints
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { helpAssistantService } from '../services/helpAssistantService';
import { helpCategories, faqs, searchArticles, getArticleById, getCategoryById } from '../help/helpContent';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, validateRequest } from '../middleware';

export const helpRouter: IRouter = Router();

// All help routes require authentication
helpRouter.use(requireAuth);

// Validation schemas
const chatSchema = {
  body: z.object({
    message: z.string().min(1).max(1000),
    context: z.object({
      currentPage: z.string(),
      currentFeature: z.string().optional(),
      userPlan: z.string(),
      userRole: z.string(),
      completedOnboarding: z.boolean(),
      enabledIntegrations: z.array(z.string()).optional(),
    }),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional().default([]),
  }),
};

const feedbackSchema = {
  body: z.object({
    responseId: z.string().uuid(),
    helpful: z.boolean(),
  }),
};

const searchSchema = {
  query: z.object({
    q: z.string().min(1).max(200),
  }),
};

const pageSchema = {
  query: z.object({
    page: z.string().optional().default('/dashboard'),
  }),
};

/**
 * @route POST /api/help/chat
 * @description Chat with the help assistant
 */
helpRouter.post(
  '/chat',
  validateRequest(chatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { message, context, history } = req.body;

    const response = await helpAssistantService.chat({
      message,
      context,
      history,
    });

    res.json({
      success: true,
      data: response,
    });
  })
);

/**
 * @route GET /api/help/suggestions
 * @description Get context-aware help suggestions
 */
helpRouter.get(
  '/suggestions',
  validateRequest(pageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page } = req.query as { page: string };

    const suggestions = helpAssistantService.getSuggestionsForPage(page);

    res.json({
      success: true,
      data: suggestions,
    });
  })
);

/**
 * @route POST /api/help/feedback
 * @description Record feedback on a help response
 */
helpRouter.post(
  '/feedback',
  validateRequest(feedbackSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { responseId, helpful } = req.body;

    await helpAssistantService.recordFeedback(responseId, helpful);

    res.json({
      success: true,
      message: 'Feedback recorded',
    });
  })
);

/**
 * @route GET /api/help/articles
 * @description Search help articles
 */
helpRouter.get(
  '/articles',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query as { q: string };

    const articles = searchArticles(q);

    res.json({
      success: true,
      data: articles.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
      })),
    });
  })
);

/**
 * @route GET /api/help/articles/:id
 * @description Get a specific help article
 */
helpRouter.get(
  '/articles/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;

    const article = getArticleById(id);

    if (!article) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Article not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: article,
    });
  })
);

/**
 * @route GET /api/help/categories
 * @description Get all help categories
 */
helpRouter.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = helpCategories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      articleCount: c.articles.length,
    }));

    res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * @route GET /api/help/categories/:id
 * @description Get a specific category with articles
 */
helpRouter.get(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;

    const category = getCategoryById(id);

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...category,
        articles: category.articles.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
        })),
      },
    });
  })
);

/**
 * @route GET /api/help/faqs
 * @description Get all FAQs
 */
helpRouter.get(
  '/faqs',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: faqs,
    });
  })
);

/**
 * @route GET /api/help/status
 * @description Check if AI help assistant is available
 */
helpRouter.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        aiAssistantAvailable: await helpAssistantService.isAvailable(),
        articlesCount: helpCategories.reduce((sum, c) => sum + c.articles.length, 0),
        faqsCount: faqs.length,
        categoriesCount: helpCategories.length,
      },
    });
  })
);
