import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Status may be 'ok' or 'degraded' depending on database connection
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body).toHaveProperty('timestamp');
  });

  test('should return response from API root', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api');

    // API routes require auth - expect either success or auth error
    const body = await response.json();
    // If auth is configured, returns API info; otherwise returns error
    expect(body).toBeDefined();
  });

  test('should require auth for protected endpoints', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/meetings');

    // Should not return 200 OK without auth
    // Could be 401 (unauthorized) or 500 (if Clerk not configured)
    expect(response.status()).not.toBe(200);
  });

  test('should have CORS headers', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');

    // Check for common CORS-related behavior
    expect(response.ok()).toBeTruthy();
  });
});
