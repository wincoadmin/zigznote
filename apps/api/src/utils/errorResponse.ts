/**
 * Standardized error response format
 * All error responses should use this structure
 */

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    validationErrors?: Array<{
      field: string;
      message: string;
    }>;
    retryAfter?: number;
  };
  traceId?: string;
  requestId?: string;
}

export interface CreateErrorResponseOptions {
  details?: unknown;
  validationErrors?: Array<{ field: string; message: string }>;
  retryAfter?: number;
  traceId?: string;
  requestId?: string;
}

/**
 * Creates a standardized error response object
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - Human-readable error message
 * @param options - Additional error details
 * @returns Formatted error response object
 */
export function createErrorResponse(
  code: string,
  message: string,
  options?: CreateErrorResponseOptions
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (options?.details !== undefined) {
    response.error.details = options.details;
  }
  if (options?.validationErrors) {
    response.error.validationErrors = options.validationErrors;
  }
  if (options?.retryAfter !== undefined) {
    response.error.retryAfter = options.retryAfter;
  }
  if (options?.traceId) {
    response.traceId = options.traceId;
  }
  if (options?.requestId) {
    response.requestId = options.requestId;
  }

  return response;
}

/**
 * Common error codes used throughout the API
 */
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Authentication/Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Business logic errors
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_OPERATION: 'INVALID_OPERATION',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
