/**
 * Tests for API Key Service
 */

import { apiKeyService, API_KEY_SCOPES, ApiKeyScope } from './apiKeyService';
import { userApiKeyRepository, __resetMocks, __stores } from '@zigznote/database';
import bcrypt from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs');

// Mock the database
jest.mock('@zigznote/database');

describe('apiKeyService', () => {
  beforeEach(() => {
    __resetMocks();
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-key');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    // Reset countByUser to return 0 by default
    (userApiKeyRepository.countByUser as jest.Mock).mockResolvedValue(0);
  });

  describe('createKey', () => {
    it('should create an API key with valid input', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Test API Key',
        scopes: ['meetings:read', 'meetings:write'] as ApiKeyScope[],
      };

      const result = await apiKeyService.createKey(input);

      expect(result.key).toMatch(/^sk_live_/);
      // Note: apiKey response doesn't include userId/organizationId - only the key metadata
      expect(result.apiKey).toMatchObject({
        name: input.name,
        scopes: input.scopes,
      });
      expect(userApiKeyRepository.create).toHaveBeenCalled();
    });

    it('should create an API key with expiration', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Expiring Key',
        scopes: ['meetings:read'] as ApiKeyScope[],
        expiresInDays: 30,
      };

      const result = await apiKeyService.createKey(input);

      expect(result.key).toBeDefined();
      expect(userApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should throw error when max keys exceeded', async () => {
      (userApiKeyRepository.countByUser as jest.Mock).mockResolvedValue(10);

      const input = {
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Too Many Keys',
        scopes: ['meetings:read'] as ApiKeyScope[],
      };

      await expect(apiKeyService.createKey(input)).rejects.toThrow(
        'Maximum of 10 API keys per user'
      );
    });

    it('should hash the key before storing', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Test Key',
        scopes: ['meetings:read'] as ApiKeyScope[],
      };

      await apiKeyService.createKey(input);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(userApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keyHash: 'hashed-key',
        })
      );
    });
  });

  describe('validateKey', () => {
    it('should validate a correct API key', async () => {
      const mockKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Test Key',
        keyPrefix: 'sk_live_abc1',
        keyHash: 'hashed',
        scopes: ['meetings:read'],
        lastUsedAt: null,
        lastUsedIp: null,
        usageCount: 0,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      };

      (userApiKeyRepository.findByPrefix as jest.Mock).mockResolvedValue([mockKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await apiKeyService.validateKey('sk_live_abc1xxxxxxx');

      expect(result).toMatchObject({
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'],
      });
      expect(userApiKeyRepository.recordUsage).toHaveBeenCalledWith('key-123');
    });

    it('should reject invalid key format', async () => {
      await expect(apiKeyService.validateKey('invalid-key')).rejects.toThrow(
        'Invalid API key format'
      );
    });

    it('should reject unknown API key', async () => {
      (userApiKeyRepository.findByPrefix as jest.Mock).mockResolvedValue([]);

      await expect(apiKeyService.validateKey('sk_live_unkn1234xxxx')).rejects.toThrow(
        'Invalid API key'
      );
    });

    it('should reject expired API key', async () => {
      const expiredKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Expired Key',
        keyPrefix: 'sk_live_abc1',
        keyHash: 'hashed',
        scopes: ['meetings:read'],
        lastUsedAt: null,
        lastUsedIp: null,
        usageCount: 0,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        revokedAt: null,
        createdAt: new Date(),
      };

      (userApiKeyRepository.findByPrefix as jest.Mock).mockResolvedValue([expiredKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Expired keys are skipped, so this should throw "Invalid API key"
      await expect(apiKeyService.validateKey('sk_live_abc1xxxxxxxx')).rejects.toThrow(
        'Invalid API key'
      );
    });

    it('should reject wrong key hash', async () => {
      const mockKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Test Key',
        keyPrefix: 'sk_live_abc1',
        keyHash: 'hashed',
        scopes: ['meetings:read'],
        lastUsedAt: null,
        lastUsedIp: null,
        usageCount: 0,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      };

      (userApiKeyRepository.findByPrefix as jest.Mock).mockResolvedValue([mockKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(apiKeyService.validateKey('sk_live_abc1wrongkey')).rejects.toThrow(
        'Invalid API key'
      );
    });
  });

  describe('hasScope', () => {
    it('should return true for valid scope', () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read', 'meetings:write'] as ApiKeyScope[],
      };

      expect(apiKeyService.hasScope(validatedKey, 'meetings:read')).toBe(true);
      expect(apiKeyService.hasScope(validatedKey, 'meetings:write')).toBe(true);
    });

    it('should return false for missing scope', () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'] as ApiKeyScope[],
      };

      expect(apiKeyService.hasScope(validatedKey, 'meetings:write')).toBe(false);
      expect(apiKeyService.hasScope(validatedKey, 'transcripts:read')).toBe(false);
    });
  });

  describe('requireScope', () => {
    it('should not throw for valid scope', () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'] as ApiKeyScope[],
      };

      expect(() => {
        apiKeyService.requireScope(validatedKey, 'meetings:read');
      }).not.toThrow();
    });

    it('should throw ForbiddenError for missing scope', () => {
      const validatedKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        scopes: ['meetings:read'] as ApiKeyScope[],
      };

      expect(() => {
        apiKeyService.requireScope(validatedKey, 'meetings:write');
      }).toThrow('API key missing required scope');
    });
  });

  describe('listKeys', () => {
    it('should list keys for a user without exposing hashes', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          userId: 'user-123',
          organizationId: 'org-123',
          name: 'Key 1',
          keyPrefix: 'sk_live_abc1',
          keyHash: 'secret-hash',
          scopes: ['meetings:read'],
          lastUsedAt: null,
          lastUsedIp: null,
          usageCount: 5,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
        },
      ];

      (userApiKeyRepository.findByUser as jest.Mock).mockResolvedValue(mockKeys);

      const result = await apiKeyService.listKeys('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('keyHash');
      expect(result[0]).toMatchObject({
        id: 'key-1',
        name: 'Key 1',
        keyPrefix: 'sk_live_abc1',
      });
    });
  });

  describe('revokeKey', () => {
    it('should revoke a key owned by the user', async () => {
      const mockKey = {
        id: 'key-123',
        userId: 'user-123',
        organizationId: 'org-123',
        name: 'Test Key',
        keyPrefix: 'sk_live_abc123',
        keyHash: 'hashed',
        scopes: ['meetings:read'],
        lastUsedAt: null,
        lastUsedIp: null,
        usageCount: 0,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      };

      (userApiKeyRepository.findById as jest.Mock).mockResolvedValue(mockKey);

      await apiKeyService.revokeKey('user-123', 'key-123');

      expect(userApiKeyRepository.revoke).toHaveBeenCalledWith('key-123');
    });

    it('should throw when key not found', async () => {
      (userApiKeyRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(apiKeyService.revokeKey('user-123', 'key-999')).rejects.toThrow(
        'API key not found'
      );
    });

    it('should throw when user does not own key', async () => {
      const mockKey = {
        id: 'key-123',
        userId: 'other-user',
        organizationId: 'org-123',
        name: 'Test Key',
        keyPrefix: 'sk_live_abc123',
        keyHash: 'hashed',
        scopes: ['meetings:read'],
        lastUsedAt: null,
        lastUsedIp: null,
        usageCount: 0,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      };

      (userApiKeyRepository.findById as jest.Mock).mockResolvedValue(mockKey);

      await expect(apiKeyService.revokeKey('user-123', 'key-123')).rejects.toThrow(
        "Cannot revoke another user's API key"
      );
    });
  });

  describe('API_KEY_SCOPES', () => {
    it('should have all expected scopes defined', () => {
      expect(API_KEY_SCOPES).toHaveProperty('meetings:read');
      expect(API_KEY_SCOPES).toHaveProperty('meetings:write');
      expect(API_KEY_SCOPES).toHaveProperty('transcripts:read');
      expect(API_KEY_SCOPES).toHaveProperty('transcripts:write');
      expect(API_KEY_SCOPES).toHaveProperty('action-items:read');
      expect(API_KEY_SCOPES).toHaveProperty('action-items:write');
      expect(API_KEY_SCOPES).toHaveProperty('webhooks:manage');
    });
  });
});
