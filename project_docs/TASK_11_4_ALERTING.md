# Task 11.4: Alerting Rules

## Overview
Implement an alerting system that monitors application metrics and sends notifications when thresholds are exceeded.

---

## Step 1: Alert Configuration

**File:** `apps/api/src/monitoring/alertConfig.ts`

```typescript
/**
 * Alert Configuration
 * Defines thresholds and rules for system alerts
 */

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  window: number; // Time window in seconds
  severity: 'info' | 'warning' | 'critical';
  cooldown: number; // Minimum seconds between alerts
  channels: ('email' | 'slack' | 'pagerduty' | 'webhook')[];
  enabled: boolean;
}

export const alertRules: AlertRule[] = [
  // Error Alerts
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Error rate exceeds 5% of requests',
    metric: 'error_rate_percent',
    condition: 'gt',
    threshold: 5,
    window: 300,
    severity: 'critical',
    cooldown: 900,
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },
  {
    id: 'elevated-error-rate',
    name: 'Elevated Error Rate',
    description: 'Error rate exceeds 1% of requests',
    metric: 'error_rate_percent',
    condition: 'gt',
    threshold: 1,
    window: 300,
    severity: 'warning',
    cooldown: 1800,
    channels: ['email', 'slack'],
    enabled: true,
  },

  // Performance Alerts
  {
    id: 'high-latency',
    name: 'High API Latency',
    description: 'P95 latency exceeds 2 seconds',
    metric: 'api_latency_p95_ms',
    condition: 'gt',
    threshold: 2000,
    window: 300,
    severity: 'warning',
    cooldown: 900,
    channels: ['email', 'slack'],
    enabled: true,
  },
  {
    id: 'critical-latency',
    name: 'Critical API Latency',
    description: 'P95 latency exceeds 5 seconds',
    metric: 'api_latency_p95_ms',
    condition: 'gt',
    threshold: 5000,
    window: 300,
    severity: 'critical',
    cooldown: 900,
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },

  // Infrastructure Alerts
  {
    id: 'database-connections',
    name: 'High Database Connections',
    description: 'Database connection pool usage exceeds 80%',
    metric: 'db_pool_usage_percent',
    condition: 'gt',
    threshold: 80,
    window: 60,
    severity: 'warning',
    cooldown: 600,
    channels: ['email', 'slack'],
    enabled: true,
  },
  {
    id: 'redis-memory',
    name: 'High Redis Memory',
    description: 'Redis memory usage exceeds 90%',
    metric: 'redis_memory_percent',
    condition: 'gt',
    threshold: 90,
    window: 60,
    severity: 'critical',
    cooldown: 600,
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },
  {
    id: 'job-queue-backlog',
    name: 'Job Queue Backlog',
    description: 'Job queue has more than 1000 pending jobs',
    metric: 'job_queue_pending',
    condition: 'gt',
    threshold: 1000,
    window: 300,
    severity: 'warning',
    cooldown: 900,
    channels: ['email', 'slack'],
    enabled: true,
  },

  // Security Alerts
  {
    id: 'brute-force-detected',
    name: 'Brute Force Detected',
    description: 'Multiple failed auth attempts from same IP',
    metric: 'auth_failures_per_ip',
    condition: 'gt',
    threshold: 10,
    window: 300,
    severity: 'critical',
    cooldown: 300,
    channels: ['email', 'slack', 'pagerduty'],
    enabled: true,
  },
  {
    id: 'suspicious-activity',
    name: 'Suspicious Activity',
    description: 'Unusual API access pattern detected',
    metric: 'suspicious_requests',
    condition: 'gt',
    threshold: 50,
    window: 300,
    severity: 'warning',
    cooldown: 600,
    channels: ['email', 'slack'],
    enabled: true,
  },

  // Business Alerts
  {
    id: 'payment-failures',
    name: 'High Payment Failure Rate',
    description: 'Payment failure rate exceeds 10%',
    metric: 'payment_failure_rate_percent',
    condition: 'gt',
    threshold: 10,
    window: 3600,
    severity: 'critical',
    cooldown: 3600,
    channels: ['email', 'slack'],
    enabled: true,
  },
  {
    id: 'transcription-failures',
    name: 'Transcription Failures',
    description: 'More than 5 transcription failures in 10 minutes',
    metric: 'transcription_failures',
    condition: 'gt',
    threshold: 5,
    window: 600,
    severity: 'warning',
    cooldown: 1800,
    channels: ['email', 'slack'],
    enabled: true,
  },
  {
    id: 'bot-failures',
    name: 'Bot Join Failures',
    description: 'More than 3 bot join failures in 10 minutes',
    metric: 'bot_join_failures',
    condition: 'gt',
    threshold: 3,
    window: 600,
    severity: 'critical',
    cooldown: 900,
    channels: ['email', 'slack'],
    enabled: true,
  },
];
```

---

## Step 2: Alert Service

**File:** `apps/api/src/monitoring/alertService.ts`

```typescript
/**
 * Alert Service
 * Monitors metrics and triggers alerts
 */

import { alertRules, AlertRule } from './alertConfig';
import { logger } from '../utils/logger';
import { emailQueue } from '../jobs/queues';
import { config } from '../config';

interface AlertState {
  lastTriggered: number;
  count: number;
}

interface MetricValue {
  value: number;
  timestamp: number;
}

class AlertService {
  private alertStates: Map<string, AlertState> = new Map();
  private metrics: Map<string, MetricValue[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    alertRules.forEach(rule => {
      this.alertStates.set(rule.id, { lastTriggered: 0, count: 0 });
      this.metrics.set(rule.metric, []);
    });
  }

  start(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.checkAllAlerts(), 30000);
    logger.info('Alert service started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Alert service stopped');
  }

  recordMetric(metric: string, value: number): void {
    const values = this.metrics.get(metric) || [];
    values.push({ value, timestamp: Date.now() });
    
    // Keep only last hour
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.set(metric, values.filter(v => v.timestamp > oneHourAgo));
  }

  private checkAllAlerts(): void {
    alertRules.filter(r => r.enabled).forEach(rule => {
      try {
        this.checkAlert(rule);
      } catch (error) {
        logger.error({ ruleId: rule.id, error }, 'Error checking alert');
      }
    });
  }

  private checkAlert(rule: AlertRule): void {
    const values = this.metrics.get(rule.metric) || [];
    const state = this.alertStates.get(rule.id)!;

    // Check cooldown
    if (Date.now() - state.lastTriggered < rule.cooldown * 1000) return;

    // Get values in window
    const windowStart = Date.now() - rule.window * 1000;
    const windowValues = values.filter(v => v.timestamp >= windowStart);
    if (windowValues.length === 0) return;

    // Calculate average
    const avgValue = windowValues.reduce((sum, v) => sum + v.value, 0) / windowValues.length;

    // Check condition
    if (this.evaluateCondition(avgValue, rule.condition, rule.threshold)) {
      this.triggerAlert(rule, avgValue);
    }
  }

  private evaluateCondition(value: number, condition: AlertRule['condition'], threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const state = this.alertStates.get(rule.id)!;
    state.lastTriggered = Date.now();
    state.count++;

    logger.warn({ alertId: rule.id, severity: rule.severity, value, threshold: rule.threshold }, `Alert: ${rule.name}`);

    for (const channel of rule.channels) {
      try {
        await this.sendToChannel(channel, rule, value);
      } catch (error) {
        logger.error({ channel, ruleId: rule.id, error }, 'Failed to send alert');
      }
    }
  }

  private async sendToChannel(channel: string, rule: AlertRule, value: number): Promise<void> {
    const message = this.formatMessage(rule, value);

    switch (channel) {
      case 'email':
        await this.sendEmail(rule, message);
        break;
      case 'slack':
        await this.sendSlack(rule, message);
        break;
      case 'pagerduty':
        await this.sendPagerDuty(rule, message);
        break;
      case 'webhook':
        await this.sendWebhook(rule, value);
        break;
    }
  }

  private formatMessage(rule: AlertRule, value: number): string {
    const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
    return `${emoji[rule.severity]} **${rule.name}**

${rule.description}

**Details:**
- Current Value: ${value.toFixed(2)}
- Threshold: ${rule.threshold}
- Severity: ${rule.severity.toUpperCase()}
- Time: ${new Date().toISOString()}`;
  }

  private async sendEmail(rule: AlertRule, message: string): Promise<void> {
    const recipients = config.alerts?.email || ['admin@zigznote.com'];
    await emailQueue.add('send-email', {
      to: recipients,
      subject: `[${rule.severity.toUpperCase()}] zigznote: ${rule.name}`,
      html: `<pre style="font-family: monospace;">${message}</pre>`,
    });
  }

  private async sendSlack(rule: AlertRule, message: string): Promise<void> {
    const webhookUrl = config.alerts?.slackWebhook;
    if (!webhookUrl) return;

    const colors = { info: '#36a64f', warning: '#ff9800', critical: '#dc3545' };
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color: colors[rule.severity],
          title: rule.name,
          text: message,
          footer: 'zigznote Monitoring',
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
  }

  private async sendPagerDuty(rule: AlertRule, message: string): Promise<void> {
    const routingKey = config.alerts?.pagerdutyKey;
    if (!routingKey) return;

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        dedup_key: rule.id,
        payload: {
          summary: `${rule.name}: ${rule.description}`,
          severity: rule.severity === 'critical' ? 'critical' : 'warning',
          source: 'zigznote',
          custom_details: { message },
        },
      }),
    });
  }

  private async sendWebhook(rule: AlertRule, value: number): Promise<void> {
    const webhookUrl = config.alerts?.webhookUrl;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertId: rule.id,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        value,
        threshold: rule.threshold,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  getAlertStates(): Array<{ rule: AlertRule; state: AlertState }> {
    return alertRules.map(rule => ({
      rule,
      state: this.alertStates.get(rule.id)!,
    }));
  }
}

export const alertService = new AlertService();
```

---

## Step 3: Metrics Collector Middleware

**File:** `apps/api/src/middleware/metricsCollector.ts`

```typescript
/**
 * Metrics Collection Middleware
 * Collects request metrics for alerting
 */

import { Request, Response, NextFunction } from 'express';
import { alertService } from '../monitoring/alertService';

let totalRequests = 0;
let errorRequests = 0;
let latencies: number[] = [];

export function metricsCollector(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  totalRequests++;

  const originalSend = res.send;
  res.send = function(body) {
    const latency = Date.now() - startTime;
    latencies.push(latency);

    // Track errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      errorRequests++;
    }

    // Record error rate
    if (totalRequests > 0) {
      alertService.recordMetric('error_rate_percent', (errorRequests / totalRequests) * 100);
    }

    // Calculate P95 latency every 100 requests
    if (latencies.length >= 100) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      alertService.recordMetric('api_latency_p95_ms', sorted[p95Index]);
      latencies = [];
    }

    return originalSend.call(this, body);
  };

  next();
}

// Reset counters every 5 minutes
setInterval(() => {
  totalRequests = 0;
  errorRequests = 0;
}, 300000);
```

---

## Step 4: Update Config

**File:** `apps/api/src/config/index.ts`

Add to the config schema and object:

```typescript
// Add to the Zod schema:
alerts: z.object({
  email: z.array(z.string().email()).optional(),
  slackWebhook: z.string().url().optional(),
  pagerdutyKey: z.string().optional(),
  webhookUrl: z.string().url().optional(),
}).optional(),

// Add to config parsing:
alerts: {
  email: process.env.ALERT_EMAILS?.split(',').map(e => e.trim()),
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
  pagerdutyKey: process.env.PAGERDUTY_ROUTING_KEY,
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
},
```

---

## Step 5: Update App.ts

**File:** `apps/api/src/app.ts`

Add imports:

```typescript
import { alertService } from './monitoring/alertService';
import { metricsCollector } from './middleware/metricsCollector';
```

Add middleware (before routes):

```typescript
// Metrics collection for alerting
app.use(metricsCollector);
```

Start alert service (after app setup):

```typescript
// Start alert monitoring
alertService.start();
```

Add to graceful shutdown:

```typescript
process.on('SIGTERM', async () => {
  alertService.stop();
  // ... existing shutdown logic
});
```

---

## Step 6: Update .env.example

**File:** `.env.example`

Add:

```bash
# Alerting Configuration
ALERT_EMAILS=admin@zigznote.com,ops@zigznote.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
PAGERDUTY_ROUTING_KEY=your-pagerduty-routing-key
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

---

## Step 7: Export from Monitoring

**File:** `apps/api/src/monitoring/index.ts`

```typescript
export { alertService } from './alertService';
export { alertRules } from './alertConfig';
export type { AlertRule } from './alertConfig';
```

---

## Verification Checklist

- [ ] Alert config file created with 12 rules
- [ ] Alert service compiles without errors
- [ ] Metrics collector middleware added to app.ts
- [ ] Alert service starts: check logs for "Alert service started"
- [ ] Config includes alerts section
- [ ] .env.example updated with alert variables

**Test alert triggering (optional):**
```typescript
// In a test file or console:
import { alertService } from './monitoring/alertService';

// Record high error rate
for (let i = 0; i < 10; i++) {
  alertService.recordMetric('error_rate_percent', 10);
}
// Wait 30 seconds for check cycle
// Should see alert in logs
```
