/**
 * External service error classes
 * These errors indicate issues with third-party services
 */

import { AppError, ErrorContext } from './base';

/**
 * Generic external service error
 * Used when a third-party API fails
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string,
    originalError?: Error,
    context?: Partial<ErrorContext>
  ) {
    super(`${service} error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', context, false);
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * Recall.ai API error
 */
export class RecallApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('Recall.ai', message, originalError, context);
  }
}

/**
 * Deepgram API error
 */
export class DeepgramApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('Deepgram', message, originalError, context);
  }
}

/**
 * Claude/Anthropic API error
 */
export class ClaudeApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('Claude', message, originalError, context);
  }
}

/**
 * OpenAI API error
 */
export class OpenAIApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('OpenAI', message, originalError, context);
  }
}

/**
 * Google Calendar API error
 */
export class GoogleCalendarApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('Google Calendar', message, originalError, context);
  }
}

/**
 * Slack API error
 */
export class SlackApiError extends ExternalServiceError {
  constructor(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super('Slack', message, originalError, context);
  }
}

/**
 * Database error - indicates a system-level database issue
 */
export class DatabaseError extends AppError {
  public readonly operation: string;
  public readonly originalError?: Error;

  constructor(operation: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super(
      `Database ${operation} failed`,
      500,
      'DATABASE_ERROR',
      context,
      false // Not operational - indicates system issue
    );
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Redis/Cache error
 */
export class CacheError extends AppError {
  public readonly operation: string;
  public readonly originalError?: Error;

  constructor(operation: string, originalError?: Error, context?: Partial<ErrorContext>) {
    super(
      `Cache ${operation} failed`,
      500,
      'CACHE_ERROR',
      context,
      false
    );
    this.operation = operation;
    this.originalError = originalError;
  }
}
