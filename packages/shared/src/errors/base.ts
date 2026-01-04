/**
 * Base error classes for zigznote
 * All application errors should extend AppError
 */

export interface ErrorContext {
  traceId: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Generates a unique trace ID for error tracking
 */
function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Base application error class
 * All custom errors should extend this class
 *
 * @property statusCode - HTTP status code for the error
 * @property code - Machine-readable error code
 * @property isOperational - Whether this is an expected operational error
 * @property context - Additional context for debugging
 * @property timestamp - When the error occurred
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    context: Partial<ErrorContext> = {},
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = {
      traceId: context.traceId || generateTraceId(),
      ...context,
    };
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializes the error for JSON responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      traceId: this.context.traceId,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
