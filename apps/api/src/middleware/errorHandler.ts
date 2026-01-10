/**
 * Global error handler middleware
 * Formats errors consistently, logs them, and sends to Sentry
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationError as SharedValidationError,
  RateLimitError,
  captureError,
  createLogger,
} from '@zigznote/shared';
import { config } from '../config';
import { createErrorResponse, ErrorCodes } from '../utils/errorResponse';

const logger = createLogger({ component: 'errorHandler' });

/**
 * Global error handler middleware
 * Formats errors consistently and logs them appropriately
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string;
  const traceId = err instanceof AppError ? err.context.traceId : requestId;

  // Log the error with context
  logger.error({
    err,
    traceId,
    requestId,
    method: req.method,
    url: req.url,
    userId: (req as unknown as { userId?: string }).userId,
  });

  // Capture non-operational errors in Sentry
  if (!(err instanceof AppError && err.isOperational)) {
    captureError(err, {
      requestId,
      method: req.method,
      url: req.url,
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json(
      createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid request data', {
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        traceId,
        requestId,
      })
    );
    return;
  }

  // Handle shared ValidationError
  if (err instanceof SharedValidationError) {
    res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, {
        validationErrors: err.validationErrors,
        traceId: err.context.traceId,
        requestId,
      })
    );
    return;
  }

  // Handle RateLimitError with Retry-After header
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', err.retryAfter.toString());
    res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, {
        retryAfter: err.retryAfter,
        traceId: err.context.traceId,
        requestId,
      })
    );
    return;
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, {
        traceId: err.context.traceId,
        requestId,
      })
    );
    return;
  }

  // Handle unknown errors
  const statusCode = 500;
  const message =
    config.nodeEnv === 'production'
      ? 'An unexpected error occurred'
      : err.message || 'Internal server error';

  res.status(statusCode).json(
    createErrorResponse(ErrorCodes.INTERNAL_ERROR, message, {
      details: config.nodeEnv !== 'production' ? { stack: err.stack } : undefined,
      traceId,
      requestId,
    })
  );
};
