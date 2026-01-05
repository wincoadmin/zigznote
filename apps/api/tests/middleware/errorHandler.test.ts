/**
 * Tests for errorHandler middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssueCode } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler';

// Mock the dependencies
jest.mock('@zigznote/shared', () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code: string,
      public isOperational: boolean = true,
      public context: { traceId?: string } = {}
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(
      message: string,
      public statusCode: number = 400,
      public code: string = 'VALIDATION_ERROR',
      public validationErrors: Record<string, string[]> = {},
      public context: { traceId?: string } = {}
    ) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  RateLimitError: class RateLimitError extends Error {
    constructor(
      message: string,
      public retryAfter: number,
      public statusCode: number = 429,
      public code: string = 'RATE_LIMIT_EXCEEDED',
      public context: { traceId?: string } = {}
    ) {
      super(message);
      this.name = 'RateLimitError';
    }
  },
  captureError: jest.fn(),
  createLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../src/config', () => ({
  config: {
    nodeEnv: 'test',
  },
}));

import { AppError, ValidationError, RateLimitError } from '@zigznote/shared';

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn(() => ({
      json: jsonMock,
    }));
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {
        'x-request-id': 'test-request-id',
      },
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
    } as unknown as Partial<Response>;
    mockNext = jest.fn();
  });

  describe('ZodError handling', () => {
    it('should format ZodError with 400 status', () => {
      const zodError = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'email',
                message: 'Expected string, received number',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('AppError handling', () => {
    it('should handle AppError with custom status code', () => {
      const appError = new AppError('Not Found', 404, 'NOT_FOUND', true, {
        traceId: 'trace-123',
      });

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Not Found',
          }),
        })
      );
    });
  });

  describe('ValidationError handling', () => {
    it('should handle ValidationError from shared package', () => {
      const validationError = new ValidationError(
        'Invalid input',
        400,
        'VALIDATION_ERROR',
        { email: ['Invalid email format'] },
        { traceId: 'trace-456' }
      );

      errorHandler(
        validationError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
          }),
        })
      );
    });
  });

  describe('RateLimitError handling', () => {
    it('should handle RateLimitError with Retry-After header', () => {
      const rateLimitError = new RateLimitError(
        'Too many requests',
        60,
        429,
        'RATE_LIMIT_EXCEEDED',
        { traceId: 'trace-789' }
      );

      errorHandler(
        rateLimitError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(setHeaderMock).toHaveBeenCalledWith('Retry-After', '60');
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          }),
        })
      );
    });
  });

  describe('unknown error handling', () => {
    it('should handle unknown errors with 500 status', () => {
      const unknownError = new Error('Something broke');

      errorHandler(
        unknownError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
          }),
        })
      );
    });
  });
});
