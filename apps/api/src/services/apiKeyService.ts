/**
 * @ownership
 * @domain User API Key Management
 * @description Handles generation, validation, and management of user API keys
 * @single-responsibility YES — all user API key operations
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { userApiKeyRepository } from '@zigznote/database';
import type { UserApiKey } from '@zigznote/database';
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '@zigznote/shared';

// Available scopes for API keys
export const API_KEY_SCOPES = {
  'meetings:read': 'View meetings and meeting details',
  'meetings:write': 'Create, update, and delete meetings',
  'transcripts:read': 'View transcripts and summaries',
  'transcripts:write': 'Update transcripts and summaries',
  'action-items:read': 'View action items',
  'action-items:write': 'Create, update, and complete action items',
  'webhooks:manage': 'Create and manage webhooks',
} as const;

export type ApiKeyScope = keyof typeof API_KEY_SCOPES;

export interface CreateApiKeyInput {
  userId: string;
  organizationId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ValidatedApiKey {
  id: string;
  userId: string;
  organizationId: string;
  scopes: string[];
}

class ApiKeyService {
  private readonly KEY_PREFIX = 'sk_live_';
  private readonly KEY_LENGTH = 32; // 32 bytes = 256 bits
  private readonly BCRYPT_ROUNDS = 10;
  private readonly MAX_KEYS_PER_USER = 10;

  /**
   * Generates a new API key for a user
   * Returns the full key ONLY ONCE - it cannot be retrieved later
   */
  async createKey(
    input: CreateApiKeyInput
  ): Promise<{ key: string; apiKey: ApiKeyResponse }> {
    // Validate scopes
    const invalidScopes = input.scopes.filter((s) => !(s in API_KEY_SCOPES));
    if (invalidScopes.length > 0) {
      throw new BadRequestError(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Limit keys per user
    const existingCount = await userApiKeyRepository.countByUser(input.userId);
    if (existingCount >= this.MAX_KEYS_PER_USER) {
      throw new BadRequestError(
        `Maximum of ${this.MAX_KEYS_PER_USER} API keys per user`
      );
    }

    // Generate secure random key
    const keyBytes = randomBytes(this.KEY_LENGTH);
    const keyBase64 = keyBytes.toString('base64url');
    const fullKey = `${this.KEY_PREFIX}${keyBase64}`;

    // Hash for storage
    const keyHash = await bcrypt.hash(fullKey, this.BCRYPT_ROUNDS);

    // Calculate expiration
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Store in database
    const apiKey = await userApiKeyRepository.create({
      userId: input.userId,
      organizationId: input.organizationId,
      name: input.name,
      keyPrefix: fullKey.substring(0, 12), // "sk_live_xxxx"
      keyHash,
      scopes: input.scopes,
      expiresAt,
    });

    return {
      key: fullKey, // Return ONCE - user must save this
      apiKey: this.toResponse(apiKey),
    };
  }

  /**
   * Validates an API key and returns the associated user/org
   * Used by auth middleware
   */
  async validateKey(key: string): Promise<ValidatedApiKey> {
    // Check format
    if (!key.startsWith(this.KEY_PREFIX)) {
      throw new UnauthorizedError('Invalid API key format');
    }

    const keyPrefix = key.substring(0, 12);

    // Find candidates by prefix (narrows down bcrypt comparisons)
    const candidates = await userApiKeyRepository.findByPrefix(keyPrefix);

    if (candidates.length === 0) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Find matching key
    for (const candidate of candidates) {
      // Skip revoked keys
      if (candidate.revokedAt) continue;

      // Skip expired keys
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;

      // Compare hash
      const isValid = await bcrypt.compare(key, candidate.keyHash);
      if (isValid) {
        // Update last used (fire and forget)
        userApiKeyRepository.recordUsage(candidate.id).catch(() => {});

        return {
          id: candidate.id,
          userId: candidate.userId,
          organizationId: candidate.organizationId,
          scopes: candidate.scopes,
        };
      }
    }

    throw new UnauthorizedError('Invalid API key');
  }

  /**
   * Checks if a validated key has the required scope
   */
  hasScope(validatedKey: ValidatedApiKey, requiredScope: ApiKeyScope): boolean {
    return validatedKey.scopes.includes(requiredScope);
  }

  /**
   * Checks scope and throws if missing
   */
  requireScope(validatedKey: ValidatedApiKey, requiredScope: ApiKeyScope): void {
    if (!this.hasScope(validatedKey, requiredScope)) {
      throw new ForbiddenError(
        `API key missing required scope: ${requiredScope}`
      );
    }
  }

  /**
   * Lists all API keys for a user (without the actual key values)
   */
  async listKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await userApiKeyRepository.findByUser(userId);
    return keys.map((k) => this.toResponse(k));
  }

  /**
   * Revokes an API key
   */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    const key = await userApiKeyRepository.findById(keyId);

    if (!key) {
      throw new NotFoundError('API key');
    }

    if (key.userId !== userId) {
      throw new ForbiddenError("Cannot revoke another user's API key");
    }

    await userApiKeyRepository.revoke(keyId);
  }

  /**
   * Updates API key name or scopes
   */
  async updateKey(
    userId: string,
    keyId: string,
    updates: { name?: string; scopes?: ApiKeyScope[] }
  ): Promise<ApiKeyResponse> {
    const key = await userApiKeyRepository.findById(keyId);

    if (!key) {
      throw new NotFoundError('API key');
    }

    if (key.userId !== userId) {
      throw new ForbiddenError("Cannot update another user's API key");
    }

    if (key.revokedAt) {
      throw new BadRequestError('Cannot update a revoked API key');
    }

    // Validate new scopes if provided
    if (updates.scopes) {
      const invalidScopes = updates.scopes.filter((s) => !(s in API_KEY_SCOPES));
      if (invalidScopes.length > 0) {
        throw new BadRequestError(`Invalid scopes: ${invalidScopes.join(', ')}`);
      }
    }

    const updated = await userApiKeyRepository.update(keyId, updates);
    return this.toResponse(updated);
  }

  private toResponse(key: UserApiKey): ApiKeyResponse {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    };
  }
}

export const apiKeyService = new ApiKeyService();
