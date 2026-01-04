/**
 * Sentry error monitoring setup for zigznote
 */

import * as Sentry from '@sentry/node';
import { AppError } from '../errors';

let isInitialized = false;

/**
 * Initialize Sentry error tracking
 * Should be called once at application startup
 */
export function initSentry(options: {
  dsn: string;
  environment: string;
  release?: string;
}) {
  if (isInitialized) return;

  if (!options.dsn) {
    console.warn('Sentry DSN not provided, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    tracesSampleRate: options.environment === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Don't send operational errors to Sentry
      // These are expected errors like 404s, validation errors, etc.
      if (error instanceof AppError && error.isOperational) {
        return null;
      }

      return event;
    },
  });

  isInitialized = true;
}

/**
 * Capture an error and send it to Sentry
 * Only captures non-operational errors (system errors, bugs)
 *
 * @param error - The error to capture
 * @param context - Additional context to attach to the error
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  // Don't report operational errors
  if (error instanceof AppError && error.isOperational) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }

    if (error instanceof AppError) {
      scope.setTag('error_code', error.code);
      scope.setExtra('traceId', error.context.traceId);
    }

    Sentry.captureException(error);
  });
}

/**
 * Set user context for Sentry
 * Useful for tracking which user experienced an error
 */
export function setUser(user: { id: string; email?: string; organizationId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
  } as Sentry.User);
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set a tag on the current scope
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

export { Sentry };
