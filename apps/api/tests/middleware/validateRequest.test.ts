/**
 * Tests for validateRequest middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, commonSchemas } from '../../src/middleware/validateRequest';

describe('validateRequest middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
    mockNext = jest.fn();
  });

  describe('body validation', () => {
    const bodySchema = {
      body: z.object({
        title: z.string().min(1),
        count: z.number().positive(),
      }),
    };

    it('should pass valid body data', async () => {
      mockReq.body = { title: 'Test', count: 5 };

      const middleware = validateRequest(bodySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject invalid body data', async () => {
      mockReq.body = { title: '', count: -1 };

      const middleware = validateRequest(bodySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject missing required fields', async () => {
      mockReq.body = {};

      const middleware = validateRequest(bodySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('query validation', () => {
    const querySchema = {
      query: z.object({
        page: z.coerce.number().positive().default(1),
        limit: z.coerce.number().positive().max(100).default(20),
      }),
    };

    it('should pass valid query parameters', async () => {
      mockReq.query = { page: '2', limit: '50' };

      const middleware = validateRequest(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 2, limit: 50 });
    });

    it('should apply defaults for missing query params', async () => {
      mockReq.query = {};

      const middleware = validateRequest(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 1, limit: 20 });
    });

    it('should reject invalid query values', async () => {
      mockReq.query = { page: '-1', limit: '200' };

      const middleware = validateRequest(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('params validation', () => {
    const paramsSchema = {
      params: z.object({
        id: z.string().uuid(),
      }),
    };

    it('should pass valid UUID params', async () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validateRequest(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid UUID params', async () => {
      mockReq.params = { id: 'invalid-uuid' };

      const middleware = validateRequest(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('combined validation', () => {
    const combinedSchema = {
      body: z.object({ title: z.string() }),
      query: z.object({ format: z.enum(['json', 'xml']).default('json') }),
      params: z.object({ id: z.string().uuid() }),
    };

    it('should validate all parts together', async () => {
      mockReq.body = { title: 'Test' };
      mockReq.query = { format: 'json' };
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validateRequest(combinedSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail if any part is invalid', async () => {
      mockReq.body = { title: 'Test' };
      mockReq.query = { format: 'invalid' };
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validateRequest(combinedSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });
});

describe('commonSchemas', () => {
  describe('uuidParam', () => {
    it('should accept valid UUIDs', () => {
      const result = commonSchemas.uuidParam.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      const result = commonSchemas.uuidParam.safeParse({ id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('pagination', () => {
    it('should accept valid pagination params', () => {
      const result = commonSchemas.pagination.safeParse({ page: 1, limit: 50 });
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = commonSchemas.pagination.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });

    it('should reject limit over 100', () => {
      const result = commonSchemas.pagination.safeParse({ page: 1, limit: 150 });
      expect(result.success).toBe(false);
    });
  });

  describe('meetingStatus', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['scheduled', 'recording', 'processing', 'completed', 'failed'];
      validStatuses.forEach(status => {
        const result = commonSchemas.meetingStatus.safeParse(status);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      const result = commonSchemas.meetingStatus.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('meetingPlatform', () => {
    it('should accept valid platforms', () => {
      const validPlatforms = ['zoom', 'meet', 'teams', 'webex', 'other'];
      validPlatforms.forEach(platform => {
        const result = commonSchemas.meetingPlatform.safeParse(platform);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('dateRange', () => {
    it('should accept valid date strings', () => {
      const result = commonSchemas.dateRange.safeParse({
        startTimeFrom: '2024-01-01',
        startTimeTo: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional date fields', () => {
      const result = commonSchemas.dateRange.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
