/**
 * Documents Route Tests
 */

import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { documentsRouter } from './documents';

// Mock the document generator service
jest.mock('../services/documentGeneratorService', () => ({
  documentGeneratorService: {
    generate: jest.fn().mockResolvedValue({
      downloadUrl: 'data:application/pdf;base64,dGVzdA==',
      fileName: 'Test_Document_123456.pdf',
      fileSize: 1024,
      expiresAt: new Date(Date.now() + 3600000),
      mimeType: 'application/pdf',
    }),
  },
}));

// Mock @zigznote/shared
jest.mock('@zigznote/shared', () => ({
  BadRequestError: class BadRequestError extends Error {
    statusCode = 400;
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
}));

// Mock auth middleware
const mockAuth = {
  userId: 'user-123',
  organizationId: 'org-123',
};

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.auth = mockAuth;
  next();
});
app.use('/api/v1/documents', documentsRouter);

// Error handler middleware
app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message,
  });
});

describe('Documents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/documents/generate', () => {
    it('should generate a PDF document', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: '# Meeting Summary\n\nThis is a test.',
          format: 'pdf',
          title: 'Test Document',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('downloadUrl');
      expect(response.body.data).toHaveProperty('fileName');
      expect(response.body.data).toHaveProperty('fileSize');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('mimeType');
    });

    it('should generate a DOCX document', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Meeting notes content',
          format: 'docx',
          title: 'Meeting Notes',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should generate a Markdown document', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Some markdown content',
          format: 'md',
          title: 'Notes',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should generate a CSV document', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: '- Item 1 (John)\n- Item 2 (Sarah)',
          format: 'csv',
          title: 'Action Items',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept optional meetingId', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Content',
          format: 'pdf',
          title: 'Test',
          meetingId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(response.status).toBe(200);
    });

    it('should accept optional contentType', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Content',
          format: 'pdf',
          title: 'Test',
          contentType: 'action_items',
        });

      expect(response.status).toBe(200);
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          format: 'pdf',
          title: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing format', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Test content',
          title: 'Test',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing title', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Test content',
          format: 'pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Test content',
          format: 'exe',
          title: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('pdf, docx, md, csv');
    });

    it('should return 400 for empty content', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: '',
          format: 'pdf',
          title: 'Test',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid meetingId format', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Content',
          format: 'pdf',
          title: 'Test',
          meetingId: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid contentType', async () => {
      const response = await request(app)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Content',
          format: 'pdf',
          title: 'Test',
          contentType: 'invalid_type',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('authentication', () => {
    it('should return 400 without auth', async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use((req, _res, next) => {
        req.auth = undefined;
        next();
      });
      noAuthApp.use('/api/v1/documents', documentsRouter);
      // Error handler
      noAuthApp.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
      });

      const response = await request(noAuthApp)
        .post('/api/v1/documents/generate')
        .send({
          content: 'Test',
          format: 'pdf',
          title: 'Test',
        });

      expect(response.status).toBe(400);
    });
  });
});
