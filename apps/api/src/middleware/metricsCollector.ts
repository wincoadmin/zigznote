/**
 * Metrics Collector Middleware
 * Collects request metrics for alerting and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { getAlertService } from '../monitoring/alertService';

interface MetricsData {
  requestCount: number;
  errorCount: number;
  latencies: number[];
  statusCodes: Map<number, number>;
  routes: Map<string, { count: number; errors: number; latencies: number[] }>;
}

// In-memory metrics storage (per window)
const metricsWindow: MetricsData = {
  requestCount: 0,
  errorCount: 0,
  latencies: [],
  statusCodes: new Map(),
  routes: new Map(),
};

// Window reset interval (every minute)
let lastReset = Date.now();
const WINDOW_DURATION = 60 * 1000;

/**
 * Reset metrics window
 */
function resetWindow(): void {
  metricsWindow.requestCount = 0;
  metricsWindow.errorCount = 0;
  metricsWindow.latencies = [];
  metricsWindow.statusCodes.clear();
  metricsWindow.routes.clear();
  lastReset = Date.now();
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Get route key for grouping metrics
 */
function getRouteKey(req: Request): string {
  // Normalize route by replacing IDs with placeholders
  const path = req.route?.path || req.path;
  return `${req.method} ${path.replace(/\/[a-f0-9-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id')}`;
}

/**
 * Flush metrics to alert service
 */
function flushMetrics(): void {
  const alertService = getAlertService();
  const totalRequests = metricsWindow.requestCount;

  if (totalRequests > 0) {
    // Calculate error rate
    const errorRate = metricsWindow.errorCount / totalRequests;
    alertService.recordMetric('error_rate', errorRate);

    // Calculate latency percentiles
    if (metricsWindow.latencies.length > 0) {
      const p50 = percentile(metricsWindow.latencies, 50);
      const p95 = percentile(metricsWindow.latencies, 95);
      const p99 = percentile(metricsWindow.latencies, 99);

      alertService.recordMetric('latency_p50', p50);
      alertService.recordMetric('latency_p95', p95);
      alertService.recordMetric('latency_p99', p99);
    }

    // Record request count
    alertService.recordMetric('request_count', totalRequests);
  }

  // Collect memory metrics
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  alertService.recordMetric('memory_usage_percent', heapUsedPercent);
}

/**
 * Metrics collector middleware
 */
export function metricsCollector(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Check if window needs reset and flush
  if (Date.now() - lastReset > WINDOW_DURATION) {
    flushMetrics();
    resetWindow();
  }

  // Increment request count
  metricsWindow.requestCount++;

  // Track route metrics
  const routeKey = getRouteKey(req);
  const routeMetrics = metricsWindow.routes.get(routeKey) || {
    count: 0,
    errors: 0,
    latencies: [],
  };
  routeMetrics.count++;

  // Override res.end to capture metrics
  const originalEnd = res.end.bind(res);
  res.end = function (
    this: Response,
    chunk?: unknown,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void
  ): Response {
    const latency = Date.now() - startTime;

    // Record latency
    metricsWindow.latencies.push(latency);
    routeMetrics.latencies.push(latency);

    // Track status codes
    const statusCount = metricsWindow.statusCodes.get(res.statusCode) || 0;
    metricsWindow.statusCodes.set(res.statusCode, statusCount + 1);

    // Track errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      metricsWindow.errorCount++;
      routeMetrics.errors++;

      // Specific tracking for auth failures
      if (res.statusCode === 401 || res.statusCode === 403) {
        getAlertService().incrementMetric('auth_failures');
      }
    }

    // Track rate limit hits
    if (res.statusCode === 429) {
      getAlertService().incrementMetric('rate_limit_hits');
    }

    metricsWindow.routes.set(routeKey, routeMetrics);

    // Call original end
    if (typeof encodingOrCallback === 'function') {
      return originalEnd(chunk, encodingOrCallback);
    }
    return originalEnd(chunk, encodingOrCallback as BufferEncoding, callback);
  } as typeof res.end;

  next();
}

/**
 * Get current metrics snapshot
 */
export function getMetricsSnapshot(): {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  statusCodes: Record<number, number>;
  topRoutes: Array<{ route: string; count: number; avgLatency: number; errorRate: number }>;
} {
  const totalRequests = metricsWindow.requestCount || 1; // Avoid division by zero

  const statusCodes: Record<number, number> = {};
  for (const [code, count] of metricsWindow.statusCodes) {
    statusCodes[code] = count;
  }

  const topRoutes = Array.from(metricsWindow.routes.entries())
    .map(([route, metrics]) => ({
      route,
      count: metrics.count,
      avgLatency:
        metrics.latencies.length > 0
          ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
          : 0,
      errorRate: metrics.count > 0 ? metrics.errors / metrics.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    requestCount: metricsWindow.requestCount,
    errorCount: metricsWindow.errorCount,
    errorRate: metricsWindow.errorCount / totalRequests,
    latencyP50: percentile(metricsWindow.latencies, 50),
    latencyP95: percentile(metricsWindow.latencies, 95),
    latencyP99: percentile(metricsWindow.latencies, 99),
    statusCodes,
    topRoutes,
  };
}

/**
 * Record a custom metric
 */
export function recordCustomMetric(name: string, value: number): void {
  getAlertService().recordMetric(name, value);
}

/**
 * Increment a counter metric
 */
export function incrementCounter(name: string, amount = 1): void {
  getAlertService().incrementMetric(name, amount);
}

/**
 * Record transcription failure
 */
export function recordTranscriptionFailure(): void {
  getAlertService().incrementMetric('transcription_failures');
}

/**
 * Record payment failure
 */
export function recordPaymentFailure(): void {
  getAlertService().incrementMetric('payment_failures');
}

/**
 * Record database pool usage
 */
export function recordDbPoolUsage(usedPercent: number): void {
  getAlertService().recordMetric('db_pool_usage_percent', usedPercent);
}

/**
 * Record Redis connection error
 */
export function recordRedisConnectionError(): void {
  getAlertService().incrementMetric('redis_connection_errors');
}
