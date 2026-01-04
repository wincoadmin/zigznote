/**
 * Domain-specific error classes for zigznote business logic
 */

import { AppError, ErrorContext } from './base';

// ==================== Meeting Errors ====================

/**
 * Meeting not found error
 */
export class MeetingNotFoundError extends AppError {
  constructor(meetingId: string, context?: Partial<ErrorContext>) {
    super(`Meeting ${meetingId} not found`, 404, 'MEETING_NOT_FOUND', {
      ...context,
      meetingId,
    });
  }
}

/**
 * Transcript not found error
 */
export class TranscriptNotFoundError extends AppError {
  constructor(meetingId: string, context?: Partial<ErrorContext>) {
    super(`Transcript for meeting ${meetingId} not found`, 404, 'TRANSCRIPT_NOT_FOUND', {
      ...context,
      meetingId,
    });
  }
}

/**
 * Summary not found error
 */
export class SummaryNotFoundError extends AppError {
  constructor(meetingId: string, context?: Partial<ErrorContext>) {
    super(`Summary for meeting ${meetingId} not found`, 404, 'SUMMARY_NOT_FOUND', {
      ...context,
      meetingId,
    });
  }
}

/**
 * Duplicate meeting error
 */
export class DuplicateMeetingError extends AppError {
  constructor(identifier: string, context?: Partial<ErrorContext>) {
    super(`Meeting with identifier ${identifier} already exists`, 409, 'DUPLICATE_MEETING', context);
  }
}

/**
 * Invalid meeting state error
 */
export class InvalidMeetingStateError extends AppError {
  constructor(currentState: string, requiredState: string, context?: Partial<ErrorContext>) {
    super(
      `Meeting is in ${currentState} state, but ${requiredState} is required`,
      400,
      'INVALID_MEETING_STATE',
      context
    );
  }
}

// ==================== Organization Errors ====================

/**
 * Organization not found error
 */
export class OrganizationNotFoundError extends AppError {
  constructor(organizationId: string, context?: Partial<ErrorContext>) {
    super(`Organization ${organizationId} not found`, 404, 'ORGANIZATION_NOT_FOUND', {
      ...context,
      organizationId,
    });
  }
}

/**
 * Organization limit exceeded error
 */
export class OrganizationLimitExceededError extends AppError {
  constructor(limit: string, context?: Partial<ErrorContext>) {
    super(`Organization ${limit} limit exceeded`, 403, 'ORGANIZATION_LIMIT_EXCEEDED', context);
  }
}

// ==================== User Errors ====================

/**
 * User not found error
 */
export class UserNotFoundError extends AppError {
  constructor(userId: string, context?: Partial<ErrorContext>) {
    super(`User ${userId} not found`, 404, 'USER_NOT_FOUND', {
      ...context,
      userId,
    });
  }
}

/**
 * User not in organization error
 */
export class UserNotInOrganizationError extends AppError {
  constructor(userId: string, organizationId: string, context?: Partial<ErrorContext>) {
    super(
      `User ${userId} is not a member of organization ${organizationId}`,
      403,
      'USER_NOT_IN_ORGANIZATION',
      { ...context, userId, organizationId }
    );
  }
}

// ==================== Action Item Errors ====================

/**
 * Action item not found error
 */
export class ActionItemNotFoundError extends AppError {
  constructor(actionItemId: string, context?: Partial<ErrorContext>) {
    super(`Action item ${actionItemId} not found`, 404, 'ACTION_ITEM_NOT_FOUND', {
      ...context,
      actionItemId,
    });
  }
}
