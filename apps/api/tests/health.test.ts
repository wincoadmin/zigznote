import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Routes', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return health status with all checks', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        checks: {
          database: expect.any(String),
          redis: expect.any(String),
        },
      });
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
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
