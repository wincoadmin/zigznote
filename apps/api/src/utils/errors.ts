/**
 * Error utilities for the API
 * Re-exports shared errors and provides convenience factory functions
 */

import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  MeetingNotFoundError,
  TranscriptNotFoundError,
  SummaryNotFoundError,
} from '@zigznote/shared';

// Re-export error classes for backward compatibility
export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  MeetingNotFoundError,
  TranscriptNotFoundError,
  SummaryNotFoundError,
};

/**
 * Common error factory functions
 * These provide a simpler API for common error cases
 */
export const errors = {
  badRequest: (message: string) => new BadRequestError(message),

  unauthorized: (message = 'Authentication required') => new UnauthorizedError(message),

  forbidden: (message = 'Access denied') => new ForbiddenError(message),

  notFound: (resource: string) => new NotFoundError(resource),

  conflict: (message: string) => new ConflictError(message),

  tooManyRequests: (retryAfter = 60) => new RateLimitError(retryAfter),

  serviceUnavailable: (service: string) => new ServiceUnavailableError(service),

  // Domain-specific errors
  meetingNotFound: (meetingId: string) => new MeetingNotFoundError(meetingId),

  transcriptNotFound: (meetingId: string) => new TranscriptNotFoundError(meetingId),

  summaryNotFound: (meetingId: string) => new SummaryNotFoundError(meetingId),
};
