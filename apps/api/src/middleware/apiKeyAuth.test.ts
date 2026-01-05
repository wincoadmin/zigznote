/**
 * Tests for API Key Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { optionalApiKeyAuth, requireApiKeyAuth, requireScope } from './apiKeyAuth';
import { apiKeyService } from '../services/apiKeyService';
import type { ApiKeyAuthenticatedRequest } from './apiKeyAuth';

// Mock the apiKeyService
jest.mock('../services/apiKeyService');

describe('API Key Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('optionalApiKeyAuth', () => {
    it('should call next without auth when no API key provided', async () => {
      await optionalApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as ApiKeyAuthenticatedRequest).apiKey).toBeUndefined();
    });

    it('should call next without auth when Bearer token is not API key format', async () => {
      mockReq.headers = { authorization: 'Bearer not-an-api-key' };

      await optionalApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as ApiKeyAuthenticatedRequest).apiKey).toBeUndefined();
    });

    it('should validate and attach API key when provided', async () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'],
      };

      mockReq.headers = { authorization: 'Bearer sk_live_abc123456789' };
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue(validatedKey);

      await optionalApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(apiKeyService.validateKey).toHaveBeenCalledWith('sk_live_abc123456789');
      expect(mockNext).toHaveBeenCalledWith();

      const authReq = mockReq as ApiKeyAuthenticatedRequest;
      expect(authReq.apiKey).toEqual(validatedKey);
      expect(authReq.authType).toBe('apiKey');
      expect(authReq.auth).toMatchObject({
        userId: 'user-123',
        organizationId: 'org-123',
      });
    });

    it('should pass error to next when API key validation fails', async () => {
      mockReq.headers = { authorization: 'Bearer sk_live_invalid12345' };
      const error = new Error('Invalid API key');
      (apiKeyService.validateKey as jest.Mock).mockRejectedValue(error);

      await optionalApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('requireApiKeyAuth', () => {
    it('should pass UnauthorizedError when no API key provided', async () => {
      await requireApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key required',
        })
      );
    });

    it('should pass UnauthorizedError when Bearer token is not API key format', async () => {
      mockReq.headers = { authorization: 'Bearer jwt-token-here' };

      await requireApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key required',
        })
      );
    });

    it('should validate and attach API key when provided', async () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read', 'meetings:write'],
      };

      mockReq.headers = { authorization: 'Bearer sk_live_validkey12345' };
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue(validatedKey);

      await requireApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      const authReq = mockReq as ApiKeyAuthenticatedRequest;
      expect(authReq.apiKey).toEqual(validatedKey);
      expect(authReq.authType).toBe('apiKey');
    });

    it('should pass error to next when API key validation fails', async () => {
      mockReq.headers = { authorization: 'Bearer sk_live_badkey123456' };
      const error = new Error('API key expired');
      (apiKeyService.validateKey as jest.Mock).mockRejectedValue(error);

      await requireApiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('requireScope', () => {
    it('should call next for session auth (skip scope check)', () => {
      const authReq = mockReq as ApiKeyAuthenticatedRequest;
      authReq.authType = undefined; // Session auth

      const middleware = requireScope('meetings:read');
      middleware(authReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next when API key has required scope', () => {
      const authReq = mockReq as ApiKeyAuthenticatedRequest;
      authReq.authType = 'apiKey';
      authReq.apiKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read', 'meetings:write'],
      };

      (apiKeyService.requireScope as jest.Mock).mockImplementation(() => {});

      const middleware = requireScope('meetings:read');
      middleware(authReq as Request, mockRes as Response, mockNext);

      expect(apiKeyService.requireScope).toHaveBeenCalledWith(authReq.apiKey, 'meetings:read');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass error to next when scope check fails', () => {
      const authReq = mockReq as ApiKeyAuthenticatedRequest;
      authReq.authType = 'apiKey';
      authReq.apiKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'],
      };

      const error = new Error('Missing required scope');
      (apiKeyService.requireScope as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const middleware = requireScope('meetings:write');
      middleware(authReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
