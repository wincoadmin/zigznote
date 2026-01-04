/**
 * Custom application error class with status codes and error codes
 */
export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error factory functions
 */
export const errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new AppError({ statusCode: 400, code: 'BAD_REQUEST', message, details }),

  unauthorized: (message = 'Unauthorized') =>
    new AppError({ statusCode: 401, code: 'UNAUTHORIZED', message }),

  forbidden: (message = 'Forbidden') =>
    new AppError({ statusCode: 403, code: 'FORBIDDEN', message }),

  notFound: (resource: string) =>
    new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `${resource} not found`,
    }),

  conflict: (message: string) =>
    new AppError({ statusCode: 409, code: 'CONFLICT', message }),

  tooManyRequests: (message = 'Too many requests') =>
    new AppError({ statusCode: 429, code: 'TOO_MANY_REQUESTS', message }),

  internal: (message = 'Internal server error') =>
    new AppError({ statusCode: 500, code: 'INTERNAL_ERROR', message }),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new AppError({ statusCode: 503, code: 'SERVICE_UNAVAILABLE', message }),
};
