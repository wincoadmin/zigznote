/**
 * Alert Service
 * Monitors metrics and triggers alerts based on configured rules
 */

import { EventEmitter } from 'events';
import { config } from '../config';
import {
  AlertRule,
  AlertSeverity,
  AlertChannel,
  getEnabledRules,
  getRulesForMetric,
} from './alertConfig';

interface MetricDataPoint {
  value: number;
  timestamp: number;
}

interface AlertState {
  ruleId: string;
  lastTriggered: number;
  isActive: boolean;
  triggeredAt?: number;
  resolvedAt?: number;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  description: string;
  severity: AlertSeverity;
  metric: string;
  currentValue: number;
  threshold: number;
  condition: string;
  triggeredAt: Date;
  channels: AlertChannel[];
}

/**
 * Alert Service - monitors metrics and triggers alerts
 */
export class AlertService extends EventEmitter {
  private metrics: Map<string, MetricDataPoint[]> = new Map();
  private alertStates: Map<string, AlertState> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private rules: AlertRule[] = [];
  private isRunning = false;

  constructor() {
    super();
    this.rules = getEnabledRules();
  }

  /**
   * Start the alert service
   */
  start(checkIntervalMs = 30000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.checkAllRules();
    }, checkIntervalMs);

    // Initial check
    this.checkAllRules();
    console.log('[AlertService] Started with', this.rules.length, 'rules');
  }

  /**
   * Stop the alert service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[AlertService] Stopped');
  }

  /**
   * Record a metric value
   */
  recordMetric(metric: string, value: number): void {
    const dataPoints = this.metrics.get(metric) || [];
    dataPoints.push({
      value,
      timestamp: Date.now(),
    });

    // Keep only last hour of data points
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = dataPoints.filter((dp) => dp.timestamp > oneHourAgo);
    this.metrics.set(metric, filtered);

    // Check rules for this metric immediately
    const rules = getRulesForMetric(metric);
    for (const rule of rules) {
      this.checkRule(rule);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementMetric(metric: string, amount = 1): void {
    const dataPoints = this.metrics.get(metric) || [];
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const lastValue = dataPoints.length > 0 && lastDataPoint ? lastDataPoint.value : 0;
    this.recordMetric(metric, lastValue + amount);
  }

  /**
   * Get current metric value (average over window)
   */
  getMetricValue(metric: string, windowMs: number): number | null {
    const dataPoints = this.metrics.get(metric);
    if (!dataPoints || dataPoints.length === 0) return null;

    const windowStart = Date.now() - windowMs;
    const windowedPoints = dataPoints.filter((dp) => dp.timestamp >= windowStart);

    if (windowedPoints.length === 0) return null;

    const sum = windowedPoints.reduce((acc, dp) => acc + dp.value, 0);
    return sum / windowedPoints.length;
  }

  /**
   * Get metric count (for counter-type metrics)
   */
  getMetricCount(metric: string, windowMs: number): number {
    const dataPoints = this.metrics.get(metric);
    if (!dataPoints || dataPoints.length === 0) return 0;

    const windowStart = Date.now() - windowMs;
    return dataPoints.filter((dp) => dp.timestamp >= windowStart).length;
  }

  /**
   * Check all enabled rules
   */
  private checkAllRules(): void {
    for (const rule of this.rules) {
      this.checkRule(rule);
    }
  }

  /**
   * Check a single rule against current metrics
   */
  private checkRule(rule: AlertRule): void {
    const value = this.getMetricValue(rule.metric, rule.windowMs);
    if (value === null) return;

    const isViolated = this.evaluateCondition(value, rule.condition, rule.threshold);
    const state = this.alertStates.get(rule.id) || {
      ruleId: rule.id,
      lastTriggered: 0,
      isActive: false,
    };

    const now = Date.now();
    const cooldownExpired = now - state.lastTriggered > rule.cooldownMs;

    if (isViolated && !state.isActive && cooldownExpired) {
      // Update state BEFORE triggering alert (so callbacks can see active state)
      state.isActive = true;
      state.lastTriggered = now;
      state.triggeredAt = now;
      this.alertStates.set(rule.id, state);

      // Trigger alert
      const alert = this.createAlert(rule, value);
      this.triggerAlert(alert);
    } else if (!isViolated && state.isActive) {
      // Resolve alert
      state.isActive = false;
      state.resolvedAt = now;
      this.alertStates.set(rule.id, state);
      this.emit('alert:resolved', { ruleId: rule.id, resolvedAt: new Date(now) });
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    value: number,
    condition: AlertRule['condition'],
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Create an alert object
   */
  private createAlert(rule: AlertRule, currentValue: number): Alert {
    return {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      severity: rule.severity,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      condition: rule.condition,
      triggeredAt: new Date(),
      channels: rule.channels,
    };
  }

  /**
   * Trigger an alert through all configured channels
   */
  private async triggerAlert(alert: Alert): Promise<void> {
    console.log(`[AlertService] Alert triggered: ${alert.ruleName}`, {
      severity: alert.severity,
      metric: alert.metric,
      value: alert.currentValue,
      threshold: alert.threshold,
    });

    this.emit('alert:triggered', alert);

    // Send to configured channels
    for (const channel of alert.channels) {
      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        console.error(`[AlertService] Failed to send alert to ${channel}:`, error);
      }
    }
  }

  /**
   * Send alert to a specific channel
   */
  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmailAlert(alert);
        break;
      case 'slack':
        await this.sendSlackAlert(alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert);
        break;
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    const recipients = config.alerts?.emailRecipients;
    if (!recipients || recipients.length === 0) {
      console.log('[AlertService] No email recipients configured, skipping email alert');
      return;
    }

    // In production, integrate with email service
    console.log('[AlertService] Email alert sent to:', recipients, alert.ruleName);
    this.emit('alert:email:sent', { alert, recipients });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert): Promise<void> {
    const webhookUrl = config.alerts?.slackWebhookUrl;
    if (!webhookUrl) {
      console.log('[AlertService] No Slack webhook configured, skipping Slack alert');
      return;
    }

    const color = alert.severity === 'critical' ? '#FF0000' : alert.severity === 'warning' ? '#FFA500' : '#0000FF';

    const payload = {
      attachments: [
        {
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.ruleName}`,
          text: alert.description,
          fields: [
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Current Value', value: String(alert.currentValue.toFixed(2)), short: true },
            { title: 'Threshold', value: `${alert.condition} ${alert.threshold}`, short: true },
            { title: 'Triggered At', value: alert.triggeredAt.toISOString(), short: true },
          ],
          footer: 'zigznote Alert System',
          ts: Math.floor(alert.triggeredAt.getTime() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      console.log('[AlertService] Slack alert sent:', alert.ruleName);
      this.emit('alert:slack:sent', { alert });
    } catch (error) {
      console.error('[AlertService] Failed to send Slack alert:', error);
      throw error;
    }
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: Alert): Promise<void> {
    const routingKey = config.alerts?.pagerDutyRoutingKey;
    if (!routingKey) {
      console.log('[AlertService] No PagerDuty routing key configured, skipping PagerDuty alert');
      return;
    }

    const payload = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: alert.ruleId,
      payload: {
        summary: `${alert.severity.toUpperCase()}: ${alert.ruleName}`,
        source: 'zigznote-api',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        timestamp: alert.triggeredAt.toISOString(),
        custom_details: {
          metric: alert.metric,
          current_value: alert.currentValue,
          threshold: alert.threshold,
          condition: alert.condition,
          description: alert.description,
        },
      },
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API returned ${response.status}`);
      }

      console.log('[AlertService] PagerDuty alert sent:', alert.ruleName);
      this.emit('alert:pagerduty:sent', { alert });
    } catch (error) {
      console.error('[AlertService] Failed to send PagerDuty alert:', error);
      throw error;
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    const webhookUrl = config.alerts?.webhookUrl;
    if (!webhookUrl) {
      console.log('[AlertService] No alert webhook configured, skipping webhook alert');
      return;
    }

    const payload = {
      type: 'alert',
      alert: {
        id: alert.id,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        description: alert.description,
        severity: alert.severity,
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        condition: alert.condition,
        triggeredAt: alert.triggeredAt.toISOString(),
      },
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Severity': alert.severity,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Alert webhook returned ${response.status}`);
      }

      console.log('[AlertService] Webhook alert sent:', alert.ruleName);
      this.emit('alert:webhook:sent', { alert });
    } catch (error) {
      console.error('[AlertService] Failed to send webhook alert:', error);
      throw error;
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Array<{ ruleId: string; triggeredAt: Date }> {
    const active: Array<{ ruleId: string; triggeredAt: Date }> = [];
    for (const [ruleId, state] of this.alertStates) {
      if (state.isActive && state.triggeredAt) {
        active.push({ ruleId, triggeredAt: new Date(state.triggeredAt) });
      }
    }
    return active;
  }

  /**
   * Get alert history for a rule
   */
  getAlertState(ruleId: string): AlertState | undefined {
    return this.alertStates.get(ruleId);
  }

  /**
   * Get all metric names being tracked
   */
  getTrackedMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.alertStates.clear();
  }
}

// Singleton instance
let alertServiceInstance: AlertService | null = null;

/**
 * Get the alert service singleton
 */
export function getAlertService(): AlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService();
  }
  return alertServiceInstance;
}

/**
 * Initialize and start the alert service
 */
export function initializeAlertService(checkIntervalMs = 30000): AlertService {
  const service = getAlertService();
  service.start(checkIntervalMs);
  return service;
}
