import request from 'supertest';
import { createApp } from '../src/app';

// Mock the database module before importing anything that uses it
jest.mock('@zigznote/database');

describe('Health Routes', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return health status with all checks', async () => {
      const response = await request(app).get('/health');

      // With mocked services, we expect the health check to succeed
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(ok|degraded)$/),
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        checks: {
          database: expect.stringMatching(/^(ok|error)$/),
          redis: expect.stringMatching(/^(ok|error)$/),
        },
      });
    });

    it('should include timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness check response', async () => {
      const response = await request(app).get('/health/ready');

      // Ready check may return 200 or 503 depending on mock state
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });
});
