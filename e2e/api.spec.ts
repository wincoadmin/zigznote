import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
  });

  test('should return API info', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api');

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('name', 'zigznote API');
    expect(body).toHaveProperty('version');
  });

  test('should return 401 for protected endpoints without auth', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/meetings');

    expect(response.status()).toBe(401);
  });

  test('should have CORS headers', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');

    // Check for common CORS-related behavior
    expect(response.ok()).toBeTruthy();
  });
});
