import request from 'supertest';
import { createApp } from '../src/app';

// Mock the database module
jest.mock('@zigznote/database');

describe('Meeting Routes', () => {
  const app = createApp();

  describe('GET /api/v1/meetings', () => {
    it('should return empty list initially', async () => {
      const response = await request(app).get('/api/v1/meetings');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/meetings')
        .query({ page: 2, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toMatchObject({
        page: 2,
        limit: 10,
      });
    });
  });

  describe('POST /api/v1/meetings', () => {
    it('should create a new meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/123456789',
      };

      const response = await request(app)
        .post('/api/v1/meetings')
        .send(meetingData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          title: 'Test Meeting',
          platform: 'zoom',
          meetingUrl: 'https://zoom.us/j/123456789',
          status: 'scheduled',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it('should reject invalid meeting data', async () => {
      const response = await request(app)
        .post('/api/v1/meetings')
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing title', async () => {
      const response = await request(app)
        .post('/api/v1/meetings')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/meetings/:id', () => {
    it('should return 404 for non-existent meeting', async () => {
      const response = await request(app).get(
        '/api/v1/meetings/non-existent-id'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return meeting by ID after creation', async () => {
      // Create a meeting first
      const createResponse = await request(app)
        .post('/api/v1/meetings')
        .send({ title: 'Get By ID Test' });

      expect(createResponse.status).toBe(201);
      const meetingId = createResponse.body.data.id;

      // Get the meeting
      const response = await request(app).get(`/api/v1/meetings/${meetingId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(meetingId);
      expect(response.body.data.title).toBe('Get By ID Test');
    });
  });

  describe('PUT /api/v1/meetings/:id', () => {
    it('should update a meeting', async () => {
      // Create a meeting first
      const createResponse = await request(app)
        .post('/api/v1/meetings')
        .send({ title: 'Update Test' });

      const meetingId = createResponse.body.data.id;

      // Update the meeting
      const updateResponse = await request(app)
        .put(`/api/v1/meetings/${meetingId}`)
        .send({ title: 'Updated Title' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.title).toBe('Updated Title');
    });

    it('should return 404 when updating non-existent meeting', async () => {
      const response = await request(app)
        .put('/api/v1/meetings/non-existent-id')
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/meetings/:id', () => {
    it('should delete a meeting', async () => {
      // Create a meeting first
      const createResponse = await request(app)
        .post('/api/v1/meetings')
        .send({ title: 'Delete Test' });

      const meetingId = createResponse.body.data.id;

      // Delete the meeting
      const deleteResponse = await request(app).delete(
        `/api/v1/meetings/${meetingId}`
      );

      expect(deleteResponse.status).toBe(204);

      // Verify it's deleted (soft delete)
      const getResponse = await request(app).get(
        `/api/v1/meetings/${meetingId}`
      );

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent meeting', async () => {
      const response = await request(app).delete(
        '/api/v1/meetings/non-existent-id'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/meetings/upcoming', () => {
    it('should return upcoming meetings', async () => {
      const response = await request(app).get('/api/v1/meetings/upcoming');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.any(Array));
    });
  });

  describe('GET /api/v1/meetings/recent', () => {
    it('should return recent completed meetings', async () => {
      const response = await request(app).get('/api/v1/meetings/recent');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.any(Array));
    });
  });

  describe('GET /api/v1/meetings/stats', () => {
    it('should return meeting statistics', async () => {
      const response = await request(app).get('/api/v1/meetings/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        byStatus: expect.any(Object),
      });
    });
  });
});
