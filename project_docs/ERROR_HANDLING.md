# zigznote Error Handling & Monitoring Guide

**Purpose:** Define error handling patterns, monitoring setup, and debugging workflows that prevent bugs and enable fast resolution.

---

## 1. Why This Matters

Good error handling provides:
- **User trust** — Graceful failures, helpful messages
- **Developer velocity** — Fast debugging with context
- **System reliability** — Prevent cascading failures
- **Production visibility** — Know about problems before users report them

---

## 2. Error Architecture

### 2.1 Custom Error Classes

Create a hierarchical error system in `packages/shared/src/errors/`:

```typescript
// packages/shared/src/errors/base.ts
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly traceId?: string;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode: number;
      isOperational?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    this.cause = options.cause;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}
```

```typescript
// packages/shared/src/errors/http.ts
import { AppError } from './base';

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      context,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      statusCode: 403,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(`${resource}${identifier ? ` (${identifier})` : ''} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      context: { resource, identifier },
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      context,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      context: { retryAfter },
    });
  }
}

export class InternalError extends AppError {
  constructor(message: string, options?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, {
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      isOperational: false,
      context: options?.context,
      cause: options?.cause,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, options?: { cause?: Error }) {
    super(`${service}: ${message}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      isOperational: true,
      context: { service },
      cause: options?.cause,
    });
  }
}
```

### 2.2 Domain-Specific Errors

```typescript
// packages/shared/src/errors/domain.ts
import { AppError } from './base';

// Meeting errors
export class MeetingNotStartedError extends AppError {
  constructor(meetingId: string) {
    super('Meeting has not started yet', {
      code: 'MEETING_NOT_STARTED',
      statusCode: 400,
      context: { meetingId },
    });
  }
}

export class MeetingAlreadyEndedError extends AppError {
  constructor(meetingId: string) {
    super('Meeting has already ended', {
      code: 'MEETING_ALREADY_ENDED',
      statusCode: 400,
      context: { meetingId },
    });
  }
}

export class TranscriptionFailedError extends AppError {
  constructor(meetingId: string, reason: string) {
    super(`Transcription failed: ${reason}`, {
      code: 'TRANSCRIPTION_FAILED',
      statusCode: 500,
      context: { meetingId, reason },
    });
  }
}

// Integration errors
export class CalendarSyncError extends AppError {
  constructor(provider: string, reason: string) {
    super(`Calendar sync failed: ${reason}`, {
      code: 'CALENDAR_SYNC_ERROR',
      statusCode: 502,
      context: { provider, reason },
    });
  }
}

export class BotJoinError extends AppError {
  constructor(platform: string, reason: string) {
    super(`Bot failed to join: ${reason}`, {
      code: 'BOT_JOIN_ERROR',
      statusCode: 502,
      context: { platform, reason },
    });
  }
}
```

---

## 3. Error Handling Middleware (Express)

```typescript
// apps/api/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, InternalError } from '@zigznote/shared/errors';
import { logger } from '../lib/logger';
import * as Sentry from '@sentry/node';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    traceId: string;
    details?: Record<string, unknown>;
  };
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  const traceId = req.traceId || 'unknown';
  
  // Normalize to AppError
  const appError = error instanceof AppError
    ? error
    : new InternalError('An unexpected error occurred', { cause: error });

  // Log all errors
  logger.error('Request failed', {
    traceId,
    error: {
      name: error.name,
      message: error.message,
      code: appError.code,
      stack: error.stack,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      userId: req.user?.id,
    },
  });

  // Report non-operational errors to Sentry
  if (!appError.isOperational) {
    Sentry.captureException(error, {
      tags: {
        traceId,
        errorCode: appError.code,
      },
      user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
      extra: {
        path: req.path,
        method: req.method,
        query: req.query,
      },
    });
  }

  // Send response
  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.isOperational 
        ? appError.message 
        : 'An unexpected error occurred. Please try again.',
      traceId,
      // Only include details for operational errors in development
      details: appError.isOperational && process.env.NODE_ENV === 'development'
        ? appError.context
        : undefined,
    },
  });
}
```

---

## 4. Sentry Setup

### 4.1 Backend Setup (Express)

```typescript
// apps/api/src/lib/sentry.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express } from 'express';

export function initSentry(app: Express): void {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not set, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version,
    
    integrations: [
      // Express integration
      Sentry.expressIntegration({ app }),
      // Profiling for performance monitoring
      nodeProfilingIntegration(),
    ],
    
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Only send errors in production-like environments
    enabled: ['production', 'staging'].includes(process.env.NODE_ENV || ''),
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Remove sensitive body fields
      if (event.request?.data) {
        const data = typeof event.request.data === 'string' 
          ? JSON.parse(event.request.data) 
          : event.request.data;
        delete data.password;
        delete data.token;
        delete data.apiKey;
        event.request.data = JSON.stringify(data);
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      'Authentication required',
      'Permission denied',
      'Rate limit exceeded',
    ],
  });
}

// Middleware to add Sentry handlers
export function sentryMiddleware(app: Express): void {
  // Request handler creates a trace for each request
  app.use(Sentry.Handlers.requestHandler());
  
  // Tracing handler for performance monitoring
  app.use(Sentry.Handlers.tracingHandler());
}

// Error handler must be after all routes
export function sentryErrorHandler(app: Express): void {
  app.use(Sentry.Handlers.errorHandler());
}
```

### 4.2 Frontend Setup (Next.js)

```typescript
// apps/web/lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

export function initSentry(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn('NEXT_PUBLIC_SENTRY_DSN not set, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

// Helper to capture errors with context
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper to add user context
export function setUser(user: { id: string; email?: string }): void {
  Sentry.setUser(user);
}

// Helper to clear user on logout
export function clearUser(): void {
  Sentry.setUser(null);
}
```

### 4.3 Next.js Configuration

```javascript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration(),
  ],
});

// apps/web/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// apps/web/sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

---

## 5. Structured Logging

### 5.1 Logger Setup

```typescript
// apps/api/src/lib/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print in development
  transport: isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  
  // Base fields on every log
  base: {
    service: 'zigznote-api',
    version: process.env.npm_package_version,
  },
  
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'apiKey',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
  
  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Child logger with request context
export function createRequestLogger(traceId: string, userId?: string) {
  return logger.child({ traceId, userId });
}
```

### 5.2 Trace ID Middleware

```typescript
// apps/api/src/middleware/trace-id.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function traceIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use existing trace ID from header or generate new one
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  
  next();
}
```

---

## 6. React Error Boundaries

### 6.1 Global Error Boundary

```tsx
// apps/web/components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-800">
          Something went wrong
        </h1>
        <p className="mt-2 text-neutral-600">
          We've been notified and are working on a fix.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-primary-500 px-4 py-2 text-white hover:bg-primary-600"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
```

### 6.2 Feature-Level Error Boundaries

```tsx
// apps/web/components/feature-error-boundary.tsx
'use client';

import { ErrorBoundary } from './error-boundary';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  feature: string;
}

export function FeatureErrorBoundary({ children, feature }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Failed to load {feature}. Please try refreshing.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## 7. API Error Handling (Frontend)

### 7.1 API Client with Error Handling

```typescript
// apps/web/lib/api-client.ts
import * as Sentry from '@sentry/nextjs';

interface ApiError {
  code: string;
  message: string;
  traceId: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const json: ApiResponse<T> = await response.json();

    if (!json.success || json.error) {
      const error = new ApiError(
        json.error?.message || 'Request failed',
        json.error?.code || 'UNKNOWN_ERROR',
        response.status,
        json.error?.traceId
      );
      
      // Report unexpected errors to Sentry
      if (response.status >= 500) {
        Sentry.captureException(error, {
          tags: { traceId: json.error?.traceId },
          extra: { path, status: response.status },
        });
      }
      
      throw error;
    }

    return json.data as T;
  }

  // Convenience methods
  get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public traceId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isValidation() {
    return this.status === 400;
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isServer() {
    return this.status >= 500;
  }
}

export const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL || '/api');
```

### 7.2 React Query Error Handling

```typescript
// apps/web/lib/query-client.ts
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof ApiError && error.isAuth) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      staleTime: 1000 * 60, // 1 minute
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toast for queries that have data (background refetch failed)
      if (query.state.data !== undefined) {
        toast.error('Failed to refresh data');
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.isAuth) {
          // Redirect to login
          window.location.href = '/login';
        } else if (!error.isValidation) {
          // Show generic error for non-validation errors
          toast.error(error.message, {
            description: error.traceId 
              ? `Reference: ${error.traceId.slice(0, 8)}` 
              : undefined,
          });
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    },
  }),
});
```

---

## 8. Environment Variables

Add to `.env.example`:

```bash
# Error Tracking (Sentry)
SENTRY_DSN=                          # Backend Sentry DSN
NEXT_PUBLIC_SENTRY_DSN=              # Frontend Sentry DSN
SENTRY_AUTH_TOKEN=                   # For source map uploads

# Logging
LOG_LEVEL=info                       # debug | info | warn | error
```

---

## 9. Monitoring Checklist

### What to Monitor

| Metric | Alert Threshold | Why |
|--------|-----------------|-----|
| Error rate | > 1% of requests | Indicates systemic issue |
| P95 latency | > 2s | Poor user experience |
| 5xx errors | > 10/minute | Server issues |
| Failed jobs | Any | Background tasks failing |
| DB connections | > 80% pool | Resource exhaustion |

### Required Dashboards

1. **Error Overview** — Error counts by type, trending
2. **API Performance** — Latency p50/p95/p99 by endpoint
3. **User Sessions** — Active users, error rate by user
4. **Background Jobs** — Queue depth, processing time, failures
5. **External Services** — Recall.ai, Deepgram, Claude API health

---

## 10. Debugging Production Issues

### Standard Workflow

1. **Get Trace ID** — From error report or user
2. **Search Logs** — Filter by trace ID
3. **Find Root Cause** — Follow trace through services
4. **Check Sentry** — Get stack trace, context
5. **Reproduce Locally** — If possible, with same inputs
6. **Fix & Deploy** — With regression test
7. **Verify Fix** — Check error rate dropped

### Common Patterns

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| 401 errors spike | Token expiry issue | Auth service logs |
| 500 errors on one endpoint | Unhandled exception | Stack trace in Sentry |
| Slow responses | Database query | Query logs, pg_stat |
| Job failures | External API | Third-party status, logs |

---

## Summary

This error handling system provides:

✅ **Consistent error format** — Same structure everywhere
✅ **User-friendly messages** — Technical details hidden
✅ **Full traceability** — Trace ID links everything
✅ **Automatic reporting** — Sentry captures production errors
✅ **Structured logging** — Easy to search and analyze
✅ **Graceful degradation** — Error boundaries prevent crashes
✅ **Type safety** — Custom error classes with TypeScript

---

**Every error is an opportunity to improve. Capture, learn, prevent.**
