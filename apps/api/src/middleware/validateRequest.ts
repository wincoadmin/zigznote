/**
 * Request validation middleware using Zod
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createErrorResponse, ErrorCodes } from '../utils/errorResponse';

/**
 * Schema configuration for request validation
 */
interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Formats Zod validation errors into a structured response
 * @param error - Zod error
 * @returns Formatted error object
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.') || 'root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Creates a validation middleware for request body, query, and params
 * @param schemas - Zod schemas for validation
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const createMeetingSchema = {
 *   body: z.object({
 *     title: z.string().min(1).max(500),
 *     platform: z.enum(['zoom', 'meet', 'teams']).optional(),
 *   }),
 * };
 *
 * router.post('/meetings', validateRequest(createMeetingSchema), controller.create);
 * ```
 */
export function validateRequest(schemas: ValidationSchemas): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      // Validate URL parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error);
        const firstError = error.errors[0];
        const message = firstError
          ? `Validation error: ${firstError.path.join('.')} ${firstError.message}`
          : 'Validation error';

        res.status(400).json(
          createErrorResponse(ErrorCodes.VALIDATION_ERROR, message, {
            details: validationErrors,
          })
        );
        return;
      }

      next(error);
    }
  };
}

/**
 * Common validation schemas that can be reused across routes
 */
export const commonSchemas = {
  /**
   * UUID parameter validation
   */
  uuidParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  /**
   * Pagination query parameters
   */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  /**
   * Meeting status enum
   */
  meetingStatus: z.enum([
    'scheduled',
    'recording',
    'processing',
    'completed',
    'failed',
  ]),

  /**
   * Meeting platform enum
   */
  meetingPlatform: z.enum(['zoom', 'meet', 'teams', 'webex', 'other']),

  /**
   * Date range query parameters
   */
  dateRange: z.object({
    startTimeFrom: z.coerce.date().optional(),
    startTimeTo: z.coerce.date().optional(),
  }),
};

/**
 * Type helper for extracting the inferred type from a Zod schema
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;
