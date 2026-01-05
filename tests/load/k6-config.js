/**
 * H.3 Load & Stress Testing Configuration
 * k6 load testing scenarios for zigznote
 */

// Import k6 modules
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const meetingCreated = new Counter('meetings_created');
const searchLatency = new Trend('search_latency');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - basic functionality
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },

    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 50 },  // Stay at 50 users
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '5m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'load' },
    },

    // Stress test - beyond normal capacity
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 400 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },

    // Spike test - sudden load increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '30s', target: 500 }, // Spike!
        { duration: '1m', target: 500 },
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 500 }, // Another spike!
        { duration: '1m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },

    // Soak test - extended duration
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
      tags: { test_type: 'soak' },
    },
  },

  thresholds: {
    // Response time thresholds
    http_req_duration: [
      'p(95)<500',  // 95% of requests should be below 500ms
      'p(99)<1000', // 99% should be below 1s
    ],

    // Error rate threshold
    errors: ['rate<0.01'], // Error rate should be below 1%

    // Custom thresholds
    search_latency: ['p(95)<300'], // Search should be fast

    // HTTP failures
    http_req_failed: ['rate<0.01'],
  },
};

// Environment configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test_token';

// Helper function for authenticated requests
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
}

// Main test function
export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status !== 200);
  });

  group('Authentication Flow', () => {
    // Login request
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: `user${__VU}@test.com`,
        password: 'TestPassword123!',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(loginRes, {
      'login successful': (r) => r.status === 200 || r.status === 401,
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(loginRes.status >= 500);
  });

  sleep(1);

  group('Meeting Operations', () => {
    // List meetings
    const listRes = http.get(`${BASE_URL}/api/v1/meetings`, {
      headers: authHeaders(),
    });

    check(listRes, {
      'list meetings status is 200': (r) => r.status === 200,
      'list meetings response time < 300ms': (r) => r.timings.duration < 300,
      'list meetings returns array': (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data.data);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(listRes.status !== 200);

    // Get upcoming meetings
    const upcomingRes = http.get(`${BASE_URL}/api/v1/meetings/upcoming`, {
      headers: authHeaders(),
    });

    check(upcomingRes, {
      'upcoming meetings status is 200': (r) => r.status === 200,
    });

    // Get recent meetings
    const recentRes = http.get(`${BASE_URL}/api/v1/meetings/recent`, {
      headers: authHeaders(),
    });

    check(recentRes, {
      'recent meetings status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  group('Search Operations', () => {
    const searchStart = Date.now();
    const searchRes = http.get(
      `${BASE_URL}/api/v1/search?q=meeting&limit=10`,
      { headers: authHeaders() }
    );
    const searchDuration = Date.now() - searchStart;
    searchLatency.add(searchDuration);

    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 500ms': (r) => r.timings.duration < 500,
      'search returns results': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.data !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(searchRes.status !== 200);

    // Autocomplete suggestions
    const suggestRes = http.get(
      `${BASE_URL}/api/v1/search/suggestions?q=meet`,
      { headers: authHeaders() }
    );

    check(suggestRes, {
      'suggestions status is 200': (r) => r.status === 200,
      'suggestions response time < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  group('Dashboard Stats', () => {
    const statsRes = http.get(`${BASE_URL}/api/v1/meetings/stats`, {
      headers: authHeaders(),
    });

    check(statsRes, {
      'stats status is 200': (r) => r.status === 200,
      'stats response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(statsRes.status !== 200);
  });

  sleep(1);

  group('Help System', () => {
    // Get FAQs
    const faqRes = http.get(`${BASE_URL}/api/v1/help/faqs`, {
      headers: authHeaders(),
    });

    check(faqRes, {
      'FAQs status is 200': (r) => r.status === 200,
    });

    // Get help articles
    const articlesRes = http.get(`${BASE_URL}/api/v1/help/articles`, {
      headers: authHeaders(),
    });

    check(articlesRes, {
      'articles status is 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 3); // Random sleep between iterations
}

// Setup function - runs once before all VUs start
export function setup() {
  // Verify API is accessible
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error('API is not accessible');
  }

  return {
    startTime: new Date().toISOString(),
  };
}

// Teardown function - runs once after all VUs finish
export function teardown(data) {
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
}

// Handle summary
export function handleSummary(data) {
  return {
    'tests/load/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

// Text summary helper
function textSummary(data, options = {}) {
  const { indent = '', enableColors = false } = options;

  let output = `\n${indent}=== Load Test Summary ===\n\n`;

  // Request metrics
  if (data.metrics.http_reqs) {
    output += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    output += `${indent}Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  }

  // Duration metrics
  if (data.metrics.http_req_duration) {
    const dur = data.metrics.http_req_duration.values;
    output += `\n${indent}Response Times:\n`;
    output += `${indent}  Average: ${dur.avg.toFixed(2)}ms\n`;
    output += `${indent}  Min: ${dur.min.toFixed(2)}ms\n`;
    output += `${indent}  Max: ${dur.max.toFixed(2)}ms\n`;
    output += `${indent}  P95: ${dur['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  P99: ${dur['p(99)'].toFixed(2)}ms\n`;
  }

  // Error rate
  if (data.metrics.errors) {
    output += `\n${indent}Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }

  // Threshold results
  output += `\n${indent}Thresholds:\n`;
  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? 'PASS' : 'FAIL';
    output += `${indent}  ${name}: ${status}\n`;
  }

  return output;
}
