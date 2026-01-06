/**
 * Tests for Alert Configuration
 */

import {
  defaultAlertRules,
  getEnabledRules,
  getRuleById,
  getRulesForMetric,
  AlertRule,
} from './alertConfig';

describe('alertConfig', () => {
  describe('defaultAlertRules', () => {
    it('should have all required rule groups', () => {
      const groupNames = defaultAlertRules.map((g) => g.name);
      expect(groupNames).toContain('Error Rates');
      expect(groupNames).toContain('Latency');
      expect(groupNames).toContain('Infrastructure');
      expect(groupNames).toContain('Security');
      expect(groupNames).toContain('Business');
    });

    it('should have valid rules in each group', () => {
      for (const group of defaultAlertRules) {
        expect(group.rules.length).toBeGreaterThan(0);
        for (const rule of group.rules) {
          expect(rule.id).toBeTruthy();
          expect(rule.name).toBeTruthy();
          expect(rule.description).toBeTruthy();
          expect(rule.metric).toBeTruthy();
          expect(['gt', 'lt', 'eq', 'gte', 'lte']).toContain(rule.condition);
          expect(typeof rule.threshold).toBe('number');
          expect(rule.windowMs).toBeGreaterThan(0);
          expect(['critical', 'warning', 'info']).toContain(rule.severity);
          expect(rule.channels.length).toBeGreaterThan(0);
          expect(rule.cooldownMs).toBeGreaterThan(0);
          expect(typeof rule.enabled).toBe('boolean');
        }
      }
    });

    it('should have unique rule IDs', () => {
      const allIds = defaultAlertRules.flatMap((g) => g.rules.map((r) => r.id));
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  describe('getEnabledRules', () => {
    it('should return only enabled rules', () => {
      const enabledRules = getEnabledRules();
      expect(enabledRules.length).toBeGreaterThan(0);
      for (const rule of enabledRules) {
        expect(rule.enabled).toBe(true);
      }
    });

    it('should return rules from all groups', () => {
      const enabledRules = getEnabledRules();
      const metrics = new Set(enabledRules.map((r) => r.metric));
      expect(metrics.size).toBeGreaterThan(3);
    });
  });

  describe('getRuleById', () => {
    it('should return rule when found', () => {
      const rule = getRuleById('high_error_rate');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('High Error Rate');
    });

    it('should return undefined for non-existent rule', () => {
      const rule = getRuleById('non_existent_rule');
      expect(rule).toBeUndefined();
    });
  });

  describe('getRulesForMetric', () => {
    it('should return all rules for a specific metric', () => {
      const rules = getRulesForMetric('error_rate');
      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule.metric).toBe('error_rate');
      }
    });

    it('should return empty array for unknown metric', () => {
      const rules = getRulesForMetric('unknown_metric');
      expect(rules).toHaveLength(0);
    });

    it('should only return enabled rules', () => {
      const rules = getRulesForMetric('error_rate');
      for (const rule of rules) {
        expect(rule.enabled).toBe(true);
      }
    });
  });

  describe('alert rule structure', () => {
    it('should have appropriate thresholds for error rates', () => {
      const errorRules = getRulesForMetric('error_rate');
      for (const rule of errorRules) {
        expect(rule.threshold).toBeGreaterThan(0);
        expect(rule.threshold).toBeLessThan(1);
      }
    });

    it('should have appropriate thresholds for latency', () => {
      const p95Rules = getRulesForMetric('latency_p95');
      const p99Rules = getRulesForMetric('latency_p99');

      for (const rule of [...p95Rules, ...p99Rules]) {
        expect(rule.threshold).toBeGreaterThan(100);
        expect(rule.threshold).toBeLessThan(60000);
      }
    });

    it('should have email and slack channels for all rules', () => {
      const enabledRules = getEnabledRules();
      for (const rule of enabledRules) {
        expect(rule.channels).toContain('email');
        expect(rule.channels).toContain('slack');
      }
    });

    it('should have pagerduty for critical rules', () => {
      const enabledRules = getEnabledRules();
      const criticalRules = enabledRules.filter((r) => r.severity === 'critical');
      for (const rule of criticalRules) {
        expect(rule.channels).toContain('pagerduty');
      }
    });
  });
});
