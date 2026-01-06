/**
 * Alert Configuration
 * Defines alert rules for monitoring system health and performance
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'email' | 'slack' | 'pagerduty' | 'webhook';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  windowMs: number;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownMs: number;
  enabled: boolean;
}

export interface AlertRuleGroup {
  name: string;
  rules: AlertRule[];
}

/**
 * Default alert rules for the application
 */
export const defaultAlertRules: AlertRuleGroup[] = [
  {
    name: 'Error Rates',
    rules: [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 5% over 5 minutes',
        metric: 'error_rate',
        condition: 'gt',
        threshold: 0.05,
        windowMs: 5 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 15 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'elevated_error_rate',
        name: 'Elevated Error Rate',
        description: 'Error rate exceeds 2% over 10 minutes',
        metric: 'error_rate',
        condition: 'gt',
        threshold: 0.02,
        windowMs: 10 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 30 * 60 * 1000,
        enabled: true,
      },
    ],
  },
  {
    name: 'Latency',
    rules: [
      {
        id: 'high_latency_p95',
        name: 'High P95 Latency',
        description: 'P95 response time exceeds 2 seconds',
        metric: 'latency_p95',
        condition: 'gt',
        threshold: 2000,
        windowMs: 5 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 15 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'critical_latency_p99',
        name: 'Critical P99 Latency',
        description: 'P99 response time exceeds 5 seconds',
        metric: 'latency_p99',
        condition: 'gt',
        threshold: 5000,
        windowMs: 5 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 15 * 60 * 1000,
        enabled: true,
      },
    ],
  },
  {
    name: 'Infrastructure',
    rules: [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds 85%',
        metric: 'memory_usage_percent',
        condition: 'gt',
        threshold: 85,
        windowMs: 5 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 30 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'critical_memory_usage',
        name: 'Critical Memory Usage',
        description: 'Memory usage exceeds 95%',
        metric: 'memory_usage_percent',
        condition: 'gt',
        threshold: 95,
        windowMs: 2 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 10 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'database_connection_pool_exhausted',
        name: 'Database Pool Exhausted',
        description: 'Database connection pool usage exceeds 90%',
        metric: 'db_pool_usage_percent',
        condition: 'gt',
        threshold: 90,
        windowMs: 2 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 10 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'redis_connection_failed',
        name: 'Redis Connection Failed',
        description: 'Redis connection failures detected',
        metric: 'redis_connection_errors',
        condition: 'gt',
        threshold: 0,
        windowMs: 1 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 5 * 60 * 1000,
        enabled: true,
      },
    ],
  },
  {
    name: 'Security',
    rules: [
      {
        id: 'high_auth_failures',
        name: 'High Authentication Failures',
        description: 'More than 50 auth failures in 5 minutes',
        metric: 'auth_failures',
        condition: 'gt',
        threshold: 50,
        windowMs: 5 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 15 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'rate_limit_abuse',
        name: 'Rate Limit Abuse Detected',
        description: 'More than 100 rate limit hits in 5 minutes',
        metric: 'rate_limit_hits',
        condition: 'gt',
        threshold: 100,
        windowMs: 5 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 30 * 60 * 1000,
        enabled: true,
      },
    ],
  },
  {
    name: 'Business',
    rules: [
      {
        id: 'transcription_failures',
        name: 'Transcription Failures',
        description: 'More than 5 transcription failures in 15 minutes',
        metric: 'transcription_failures',
        condition: 'gt',
        threshold: 5,
        windowMs: 15 * 60 * 1000,
        severity: 'warning',
        channels: ['email', 'slack'],
        cooldownMs: 30 * 60 * 1000,
        enabled: true,
      },
      {
        id: 'payment_failures',
        name: 'Payment Processing Failures',
        description: 'More than 3 payment failures in 10 minutes',
        metric: 'payment_failures',
        condition: 'gt',
        threshold: 3,
        windowMs: 10 * 60 * 1000,
        severity: 'critical',
        channels: ['email', 'slack', 'pagerduty'],
        cooldownMs: 15 * 60 * 1000,
        enabled: true,
      },
    ],
  },
];

/**
 * Get all enabled alert rules
 */
export function getEnabledRules(): AlertRule[] {
  return defaultAlertRules.flatMap((group) => group.rules.filter((rule) => rule.enabled));
}

/**
 * Get alert rule by ID
 */
export function getRuleById(id: string): AlertRule | undefined {
  for (const group of defaultAlertRules) {
    const rule = group.rules.find((r) => r.id === id);
    if (rule) return rule;
  }
  return undefined;
}

/**
 * Get all rules for a specific metric
 */
export function getRulesForMetric(metric: string): AlertRule[] {
  return defaultAlertRules.flatMap((group) =>
    group.rules.filter((rule) => rule.metric === metric && rule.enabled)
  );
}
