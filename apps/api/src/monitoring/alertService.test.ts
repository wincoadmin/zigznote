/**
 * Tests for Alert Service
 */

import { AlertService, getAlertService, initializeAlertService } from './alertService';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    service = new AlertService();
    service.clearMetrics();
  });

  afterEach(() => {
    service.stop();
  });

  describe('recordMetric', () => {
    it('should record a metric value', () => {
      service.recordMetric('test_metric', 100);
      const value = service.getMetricValue('test_metric', 60000);
      expect(value).toBe(100);
    });

    it('should average multiple values', () => {
      service.recordMetric('test_metric', 100);
      service.recordMetric('test_metric', 200);
      const value = service.getMetricValue('test_metric', 60000);
      expect(value).toBe(150);
    });

    it('should return null for unknown metric', () => {
      const value = service.getMetricValue('unknown_metric', 60000);
      expect(value).toBeNull();
    });
  });

  describe('incrementMetric', () => {
    it('should increment a counter metric', () => {
      service.incrementMetric('counter', 1);
      service.incrementMetric('counter', 2);
      const count = service.getMetricCount('counter', 60000);
      expect(count).toBe(2);
    });

    it('should default increment to 1', () => {
      service.incrementMetric('counter');
      const value = service.getMetricValue('counter', 60000);
      expect(value).toBe(1);
    });
  });

  describe('getMetricCount', () => {
    it('should count data points in window', () => {
      service.recordMetric('events', 1);
      service.recordMetric('events', 1);
      service.recordMetric('events', 1);
      const count = service.getMetricCount('events', 60000);
      expect(count).toBe(3);
    });

    it('should return 0 for unknown metric', () => {
      const count = service.getMetricCount('unknown', 60000);
      expect(count).toBe(0);
    });
  });

  describe('alert triggering', () => {
    it('should emit alert:triggered when threshold exceeded', () => {
      const mockHandler = jest.fn();
      service.on('alert:triggered', mockHandler);

      // Record high error rate (> 5%) - this triggers both high_error_rate and elevated_error_rate
      service.recordMetric('error_rate', 0.10);

      // Should trigger at least once (may trigger multiple rules)
      expect(mockHandler).toHaveBeenCalled();

      // Check that High Error Rate was triggered
      const calls = mockHandler.mock.calls;
      const highErrorRateCall = calls.find(
        (call: unknown[]) => (call[0] as { ruleName: string }).ruleName === 'High Error Rate'
      );
      expect(highErrorRateCall).toBeDefined();
    });

    it('should emit alert:resolved when metric returns to normal', () => {
      const mockTriggered = jest.fn();
      const mockResolved = jest.fn();

      service.on('alert:triggered', mockTriggered);
      service.on('alert:resolved', mockResolved);

      // Trigger alert with high error rate - using latency to test single rule
      service.recordMetric('latency_p99', 6000);
      expect(mockTriggered).toHaveBeenCalled();

      // Return to normal
      service.recordMetric('latency_p99', 1000);
      expect(mockResolved).toHaveBeenCalled();
    });

    it('should not re-trigger same alert when still violated', () => {
      const mockHandler = jest.fn();
      service.on('alert:triggered', mockHandler);

      // Use latency_p99 which only has one rule
      service.recordMetric('latency_p99', 6000);
      service.recordMetric('latency_p99', 7000);
      service.recordMetric('latency_p99', 8000);

      // Should only trigger once for critical_latency_p99 rule
      const p99Calls = mockHandler.mock.calls.filter(
        (call: unknown[]) => (call[0] as { ruleId: string }).ruleId === 'critical_latency_p99'
      );
      expect(p99Calls).toHaveLength(1);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return empty array when no alerts', () => {
      const active = service.getActiveAlerts();
      expect(active).toHaveLength(0);
    });

    it('should return active alerts after trigger', () => {
      // Trigger alert using latency_p99 (single rule)
      service.recordMetric('latency_p99', 6000);

      const active = service.getActiveAlerts();
      expect(active.length).toBeGreaterThan(0);
      expect(active.some(a => a.ruleId === 'critical_latency_p99')).toBe(true);
    });

    it('should remove alert from active after resolution', () => {
      // Trigger alert using latency_p99 (single rule)
      service.recordMetric('latency_p99', 6000);

      const activeBefore = service.getActiveAlerts();
      expect(activeBefore.some(a => a.ruleId === 'critical_latency_p99')).toBe(true);

      // Resolve alert
      service.recordMetric('latency_p99', 1000);

      const activeAfter = service.getActiveAlerts();
      expect(activeAfter.some(a => a.ruleId === 'critical_latency_p99')).toBe(false);
    });
  });

  describe('getAlertState', () => {
    it('should return undefined for unknown rule', () => {
      const state = service.getAlertState('unknown_rule');
      expect(state).toBeUndefined();
    });

    it('should return state after alert triggered', () => {
      // Trigger alert using latency_p99
      service.recordMetric('latency_p99', 6000);

      const state = service.getAlertState('critical_latency_p99');
      expect(state).toBeDefined();
      expect(state?.isActive).toBe(true);
      expect(state?.triggeredAt).toBeDefined();
    });

    it('should update state when alert resolved', () => {
      // Trigger using latency_p99
      service.recordMetric('latency_p99', 6000);

      // Resolve
      service.recordMetric('latency_p99', 1000);

      const state = service.getAlertState('critical_latency_p99');
      expect(state?.isActive).toBe(false);
      expect(state?.resolvedAt).toBeDefined();
    });
  });

  describe('getTrackedMetrics', () => {
    it('should return list of tracked metrics', () => {
      service.recordMetric('metric_a', 100);
      service.recordMetric('metric_b', 200);
      const tracked = service.getTrackedMetrics();
      expect(tracked).toContain('metric_a');
      expect(tracked).toContain('metric_b');
    });
  });

  describe('start/stop', () => {
    it('should start and stop the service', () => {
      expect(() => service.start()).not.toThrow();
      expect(() => service.stop()).not.toThrow();
    });

    it('should handle multiple starts', () => {
      service.start();
      expect(() => service.start()).not.toThrow();
      service.stop();
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics and states', () => {
      service.recordMetric('test', 100);
      service.clearMetrics();
      expect(service.getMetricValue('test', 60000)).toBeNull();
      expect(service.getTrackedMetrics()).toHaveLength(0);
    });
  });
});

describe('getAlertService', () => {
  it('should return singleton instance', () => {
    const instance1 = getAlertService();
    const instance2 = getAlertService();
    expect(instance1).toBe(instance2);
  });
});

describe('initializeAlertService', () => {
  afterEach(() => {
    getAlertService().stop();
  });

  it('should initialize and start the service', () => {
    const service = initializeAlertService(60000);
    expect(service).toBeDefined();
  });
});
