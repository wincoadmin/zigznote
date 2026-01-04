/**
 * HTTP error classes for common API error responses
 */

import { AppError, ErrorContext } from './base';

/**
 * 400 Bad Request - Generic bad request error
 */
export class BadRequestError extends AppError {
  constructor(message: string, context?: Partial<ErrorContext>) {
    super(message, 400, 'BAD_REQUEST', context);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', context?: Partial<ErrorContext>) {
    super(message, 401, 'UNAUTHORIZED', context);
  }
}

/**
 * 403 Forbidden - Access denied
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', context?: Partial<ErrorContext>) {
    super(message, 403, 'FORBIDDEN', context);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string, context?: Partial<ErrorContext>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', context);
  }
}

/**
 * 409 Conflict - Resource conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Partial<ErrorContext>) {
    super(message, 409, 'CONFLICT', context);
  }
}

/**
 * 400 Validation Error - Input validation failed
 */
export class ValidationError extends AppError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    errors: Array<{ field: string; message: string }>,
    context?: Partial<ErrorContext>
  ) {
    super('Validation failed', 400, 'VALIDATION_ERROR', context);
    this.validationErrors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

/**
 * 429 Rate Limit Exceeded
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number, context?: Partial<ErrorContext>) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', context);
    this.retryAfter = retryAfter;
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, context?: Partial<ErrorContext>) {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE', context);
  }
}
