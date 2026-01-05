# Phase 6.5: User API Keys

**Goal:** Allow users to generate personal API keys to connect external apps (Zapier, custom scripts, mobile apps) to their zigznote account.

**Model:** Default for most, ultrathink for security design

---

## Pre-Phase Checklist

- [ ] Read PHASE_6_COMPLETE.md
- [ ] Read project_docs/GOVERNANCE.md  
- [ ] Read project_docs/ERROR_HANDLING.md
- [ ] Verify Phase 6 tests pass: `pnpm test`

---

## Mandatory Update (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_6_5_COMPLETE.md with summary and key decisions
2. Update PHASES.md to mark Phase 6.5 as complete
3. Run all tests and record coverage

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md
7. Check for duplicates before creating new code
8. Domain cohesion > line counts (large files OK if single responsibility)
9. Update PHASES.md at the end of this phase

=== TASK LIST (Execute All) ===

**6.5.1 Database Schema**

Add to packages/database/prisma/schema.prisma (after the User model):

```prisma
// ============================================
// User API Keys
// ============================================

model UserApiKey {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  organizationId String    @map("organization_id")
  
  name           String    // User-provided name: "My Zapier Key", "Mobile App"
  keyPrefix      String    @map("key_prefix") // First 12 chars for identification: "sk_live_xxxx"
  keyHash        String    @unique @map("key_hash") // bcrypt hash of full key
  
  // Permissions (granular scopes)
  scopes         String[]  // ["meetings:read", "meetings:write", "transcripts:read"]
  
  // Usage tracking
  lastUsedAt     DateTime? @map("last_used_at")
  lastUsedIp     String?   @map("last_used_ip")
  usageCount     Int       @default(0) @map("usage_count")
  
  // Lifecycle
  expiresAt      DateTime? @map("expires_at")
  revokedAt      DateTime? @map("revoked_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
  @@index([keyPrefix])
  @@map("user_api_keys")
}
```

Update the User model to add the relation:
```prisma
model User {
  // ... existing fields ...
  apiKeys             UserApiKey[]
}
```

Update the Organization model to add the relation:
```prisma
model Organization {
  // ... existing fields ...
  userApiKeys         UserApiKey[]
}
```

Run migration:
```bash
pnpm db:migrate --name add_user_api_keys
```

**6.5.2 Database Types**

Add to packages/database/src/types/index.ts:

```typescript
/**
 * Create user API key input
 */
export interface CreateUserApiKeyInput {
  userId: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date | null;
}

/**
 * Update user API key input
 */
export interface UpdateUserApiKeyInput {
  name?: string;
  scopes?: string[];
}
```

**6.5.3 API Key Repository**

Create packages/database/src/repositories/userApiKeyRepository.ts:

```typescript
/**
 * @ownership
 * @domain User API Key Data Access
 * @description Database operations for user API keys
 * @single-responsibility YES — all UserApiKey database operations
 */

import type { UserApiKey } from '@prisma/client';
import { prisma } from '../client';
import type { CreateUserApiKeyInput, UpdateUserApiKeyInput } from '../types';

export class UserApiKeyRepository {
  async create(data: CreateUserApiKeyInput): Promise<UserApiKey> {
    return prisma.userApiKey.create({ data });
  }

  async findById(id: string): Promise<UserApiKey | null> {
    return prisma.userApiKey.findUnique({ where: { id } });
  }

  async findByUser(userId: string): Promise<UserApiKey[]> {
    return prisma.userApiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPrefix(keyPrefix: string): Promise<UserApiKey[]> {
    return prisma.userApiKey.findMany({
      where: { keyPrefix },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return prisma.userApiKey.count({
      where: { userId, revokedAt: null },
    });
  }

  async recordUsage(id: string, ip?: string): Promise<void> {
    await prisma.userApiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ip,
        usageCount: { increment: 1 },
      },
    });
  }

  async revoke(id: string): Promise<void> {
    await prisma.userApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async update(id: string, data: UpdateUserApiKeyInput): Promise<UserApiKey> {
    return prisma.userApiKey.update({
      where: { id },
      data,
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.userApiKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: { not: null },
      },
    });
    return result.count;
  }
}

export const userApiKeyRepository = new UserApiKeyRepository();
```

Update packages/database/src/repositories/index.ts to add:
```typescript
export {
  UserApiKeyRepository,
  userApiKeyRepository,
} from './userApiKeyRepository';
```

Update packages/database/src/index.ts to export the UserApiKey type:
```typescript
export type {
  // ... existing exports ...
  UserApiKey,
} from '@prisma/client';
```

**6.5.4 API Key Service**

Create apps/api/src/services/apiKeyService.ts:

```typescript
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
import { UnauthorizedError, NotFoundError, BadRequestError, ForbiddenError } from '@zigznote/shared';

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
  async createKey(input: CreateApiKeyInput): Promise<{ key: string; apiKey: ApiKeyResponse }> {
    // Validate scopes
    const invalidScopes = input.scopes.filter(s => !(s in API_KEY_SCOPES));
    if (invalidScopes.length > 0) {
      throw new BadRequestError(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Limit keys per user
    const existingCount = await userApiKeyRepository.countByUser(input.userId);
    if (existingCount >= this.MAX_KEYS_PER_USER) {
      throw new BadRequestError(`Maximum of ${this.MAX_KEYS_PER_USER} API keys per user`);
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
      throw new ForbiddenError(`API key missing required scope: ${requiredScope}`);
    }
  }

  /**
   * Lists all API keys for a user (without the actual key values)
   */
  async listKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await userApiKeyRepository.findByUser(userId);
    return keys.map(k => this.toResponse(k));
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
      throw new ForbiddenError('Cannot revoke another user\'s API key');
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
      throw new ForbiddenError('Cannot update another user\'s API key');
    }

    if (key.revokedAt) {
      throw new BadRequestError('Cannot update a revoked API key');
    }

    // Validate new scopes if provided
    if (updates.scopes) {
      const invalidScopes = updates.scopes.filter(s => !(s in API_KEY_SCOPES));
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
```

Update apps/api/src/services/index.ts to export:
```typescript
export { apiKeyService, API_KEY_SCOPES, type ApiKeyScope, type ValidatedApiKey } from './apiKeyService';
```

**6.5.5 API Key Auth Middleware**

Create apps/api/src/middleware/apiKeyAuth.ts:

```typescript
/**
 * Middleware for API key authentication
 * Supports both session auth (Clerk) and API key auth
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService, type ApiKeyScope, type ValidatedApiKey } from '../services/apiKeyService';
import { UnauthorizedError } from '@zigznote/shared';
import type { AuthenticatedRequest } from './auth';

// Extend AuthenticatedRequest to include API key info
export interface ApiKeyAuthenticatedRequest extends AuthenticatedRequest {
  apiKey?: ValidatedApiKey;
  authType?: 'session' | 'apiKey';
}

/**
 * Extracts API key from Authorization header
 * Format: Authorization: Bearer sk_live_xxxxx
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') return null;
  if (!token?.startsWith('sk_live_')) return null;

  return token;
}

/**
 * Middleware that accepts either session auth OR API key
 * Use this for routes that support both auth methods
 * Should be placed BEFORE requireAuth
 */
export const optionalApiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    try {
      const validated = await apiKeyService.validateKey(apiKey);
      const authReq = req as ApiKeyAuthenticatedRequest;
      authReq.apiKey = validated;
      authReq.authType = 'apiKey';
      // Set auth for downstream compatibility with existing middleware
      authReq.auth = {
        userId: validated.userId,
        clerkUserId: '', // Not applicable for API key auth
        organizationId: validated.organizationId,
        email: '', // Not applicable for API key auth
        role: 'member', // API keys have member-level access
      };
      next();
    } catch (error) {
      next(error);
    }
  } else {
    // No API key - continue to session auth middleware
    next();
  }
};

/**
 * Middleware that REQUIRES API key auth (no session fallback)
 * Use this for programmatic-only endpoints
 */
export const requireApiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next(new UnauthorizedError('API key required'));
  }

  try {
    const validated = await apiKeyService.validateKey(apiKey);
    const authReq = req as ApiKeyAuthenticatedRequest;
    authReq.apiKey = validated;
    authReq.authType = 'apiKey';
    authReq.auth = {
      userId: validated.userId,
      clerkUserId: '',
      organizationId: validated.organizationId,
      email: '',
      role: 'member',
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory that requires a specific scope
 * Usage: requireScope('meetings:read')
 */
export const requireScope = (scope: ApiKeyScope) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as ApiKeyAuthenticatedRequest;

    // Only check scope for API key auth
    if (authReq.authType !== 'apiKey' || !authReq.apiKey) {
      return next(); // Session auth, skip scope check
    }

    try {
      apiKeyService.requireScope(authReq.apiKey, scope);
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

Update apps/api/src/middleware/index.ts to add:
```typescript
export {
  optionalApiKeyAuth,
  requireApiKeyAuth,
  requireScope,
  type ApiKeyAuthenticatedRequest,
} from './apiKeyAuth';
```

**6.5.6 API Key Routes**

Create apps/api/src/routes/apiKeys.ts:

```typescript
/**
 * User API Key management routes
 * Requires session authentication (users manage their own keys)
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { apiKeyService, API_KEY_SCOPES } from '../services/apiKeyService';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';

export const apiKeysRouter: IRouter = Router();

// All routes require session auth (not API key auth)
apiKeysRouter.use(requireAuth);

// Validation schemas
const createKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.enum(Object.keys(API_KEY_SCOPES) as [string, ...string[]])).min(1),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),
});

const updateKeySchema = z.object({
  params: z.object({
    keyId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    scopes: z.array(z.enum(Object.keys(API_KEY_SCOPES) as [string, ...string[]])).min(1).optional(),
  }),
});

/**
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user
 */
apiKeysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const keys = await apiKeyService.listKeys(authReq.auth!.userId);

    res.json({
      success: true,
      data: keys,
    });
  })
);

/**
 * GET /api/v1/api-keys/scopes
 * List all available scopes with descriptions
 */
apiKeysRouter.get(
  '/scopes',
  asyncHandler(async (_req, res) => {
    const scopes = Object.entries(API_KEY_SCOPES).map(([key, description]) => ({
      scope: key,
      description,
    }));

    res.json({
      success: true,
      data: scopes,
    });
  })
);

/**
 * POST /api/v1/api-keys
 * Create a new API key
 * Returns the full key ONCE - user must save it
 */
apiKeysRouter.post(
  '/',
  validateRequest(createKeySchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { key, apiKey } = await apiKeyService.createKey({
      userId: authReq.auth!.userId,
      organizationId: authReq.auth!.organizationId,
      name: req.body.name,
      scopes: req.body.scopes,
      expiresInDays: req.body.expiresInDays,
    });

    res.status(201).json({
      success: true,
      data: {
        ...apiKey,
        key, // Full key - shown ONCE
      },
      message: 'API key created. Save this key now - it cannot be retrieved later.',
    });
  })
);

/**
 * PATCH /api/v1/api-keys/:keyId
 * Update an API key's name or scopes
 */
apiKeysRouter.patch(
  '/:keyId',
  validateRequest(updateKeySchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const updated = await apiKeyService.updateKey(
      authReq.auth!.userId,
      req.params.keyId,
      req.body
    );

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/v1/api-keys/:keyId
 * Revoke an API key
 */
apiKeysRouter.delete(
  '/:keyId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await apiKeyService.revokeKey(authReq.auth!.userId, req.params.keyId);

    res.json({
      success: true,
      message: 'API key revoked',
    });
  })
);
```

Register routes in apps/api/src/routes/api.ts:
```typescript
import { apiKeysRouter } from './apiKeys';

// Add to router (after existing routes)
apiRouter.use('/v1/api-keys', apiKeysRouter);
```

**6.5.7 Update Meetings Routes for API Key Auth**

Update apps/api/src/routes/meetings.ts to support API key auth:

At the top, add imports:
```typescript
import { optionalApiKeyAuth, requireScope } from '../middleware';
```

After the router creation, add optionalApiKeyAuth BEFORE requireAuth:
```typescript
export const meetingsRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
meetingsRouter.use(optionalApiKeyAuth);
meetingsRouter.use(requireAuth);
```

Add scope requirements to routes (examples):
```typescript
// For read operations - add requireScope after the path
meetingsRouter.get('/', requireScope('meetings:read'), meetingController.list.bind(meetingController));
meetingsRouter.get('/upcoming', requireScope('meetings:read'), meetingController.getUpcoming.bind(meetingController));
meetingsRouter.get('/recent', requireScope('meetings:read'), meetingController.getRecent.bind(meetingController));
meetingsRouter.get('/stats', requireScope('meetings:read'), meetingController.getStats.bind(meetingController));
meetingsRouter.get('/:id', requireScope('meetings:read'), meetingController.getById.bind(meetingController));

// For write operations
meetingsRouter.post('/', requireScope('meetings:write'), meetingController.create.bind(meetingController));
meetingsRouter.put('/:id', requireScope('meetings:write'), meetingController.update.bind(meetingController));
meetingsRouter.delete('/:id', requireScope('meetings:write'), meetingController.delete.bind(meetingController));

// For transcript/summary routes
meetingsRouter.get('/:id/transcript', requireScope('transcripts:read'), meetingController.getTranscript.bind(meetingController));
meetingsRouter.get('/:id/summary', requireScope('transcripts:read'), meetingController.getSummary.bind(meetingController));

// For action items
meetingsRouter.get('/:id/action-items', requireScope('action-items:read'), meetingController.getActionItems.bind(meetingController));
meetingsRouter.patch('/:id/action-items/:actionItemId', requireScope('action-items:write'), meetingController.updateActionItem.bind(meetingController));
meetingsRouter.delete('/:id/action-items/:actionItemId', requireScope('action-items:write'), meetingController.deleteActionItem.bind(meetingController));
```

**6.5.8 Add bcryptjs Dependency**

Add bcryptjs to the API package:
```bash
cd apps/api
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

**6.5.9 Frontend: Add API to lib/api.ts**

Add to apps/web/lib/api.ts:

```typescript
// API Keys API methods
export const apiKeysApi = {
  list: () => api.get<ApiKeyResponse[]>('/api/v1/api-keys'),

  getScopes: () => api.get<Array<{ scope: string; description: string }>>('/api/v1/api-keys/scopes'),

  create: (data: { name: string; scopes: string[]; expiresInDays?: number }) =>
    api.post<ApiKeyResponse & { key: string }>('/api/v1/api-keys', data),

  update: (keyId: string, data: { name?: string; scopes?: string[] }) =>
    api.patch<ApiKeyResponse>(`/api/v1/api-keys/${keyId}`, data),

  revoke: (keyId: string) => api.delete(`/api/v1/api-keys/${keyId}`),
};

interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}
```

**6.5.10 Frontend: Update Settings Layout**

Update apps/web/app/settings/layout.tsx to add API Keys to navigation:

```typescript
const settingsNav = [
  { name: 'General', href: '/settings' },
  { name: 'Integrations', href: '/settings/integrations' },
  { name: 'API Keys', href: '/settings/api-keys' },  // ADD THIS LINE
  { name: 'Webhooks', href: '/settings/webhooks' },
  { name: 'Billing', href: '/settings/billing' },
];
```

**6.5.11 Frontend: API Keys Settings Page**

Create apps/web/app/settings/api-keys/page.tsx:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { apiKeysApi } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface Scope {
  scope: string;
  description: string;
}

const SCOPE_GROUPS: Record<string, string[]> = {
  'Meetings': ['meetings:read', 'meetings:write'],
  'Transcripts & Summaries': ['transcripts:read', 'transcripts:write'],
  'Action Items': ['action-items:read', 'action-items:write'],
  'Webhooks': ['webhooks:manage'],
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    scopes: [] as string[],
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeys();
    loadScopes();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    const response = await apiKeysApi.list();
    if (response.success && response.data) {
      setKeys(response.data);
    }
    setIsLoading(false);
  };

  const loadScopes = async () => {
    const response = await apiKeysApi.getScopes();
    if (response.success && response.data) {
      setScopes(response.data);
    }
  };

  const handleCreate = async () => {
    if (!newKeyForm.name || newKeyForm.scopes.length === 0) return;

    const response = await apiKeysApi.create({
      name: newKeyForm.name,
      scopes: newKeyForm.scopes,
    });

    if (response.success && response.data) {
      setNewKeyValue(response.data.key);
      setShowCreateModal(false);
      setShowKeyModal(true);
      setNewKeyForm({ name: '', scopes: [] });
      loadKeys();
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    const response = await apiKeysApi.revoke(keyId);
    if (response.success) {
      loadKeys();
    }
  };

  const handleCopy = () => {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyForm(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
          <p className="text-sm text-slate-500">
            Manage API keys for external integrations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create API Key</Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            Loading...
          </CardContent>
        </Card>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No API keys</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create an API key to connect external services.
            </p>
            <div className="mt-6">
              <Button onClick={() => setShowCreateModal(true)}>Create API Key</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{key.name}</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-mono">
                      {key.keyPrefix}••••••••••••
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Last used: {formatDate(key.lastUsedAt)} • {key.usageCount} requests
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleRevoke(key.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Key Name
                </label>
                <Input
                  value={newKeyForm.name}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                  placeholder="e.g., Zapier Integration"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-4">
                  {Object.entries(SCOPE_GROUPS).map(([group, groupScopes]) => (
                    <div key={group}>
                      <div className="text-sm text-slate-500 mb-2">{group}</div>
                      <div className="space-y-2">
                        {groupScopes.map((scope) => (
                          <label
                            key={scope}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={newKeyForm.scopes.includes(scope)}
                              onChange={() => toggleScope(scope)}
                            />
                            <span className="text-sm text-slate-700">{scope}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyForm.name || newKeyForm.scopes.length === 0}
                >
                  Create Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show Key Modal (one-time) */}
      {showKeyModal && newKeyValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>API Key Created</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-amber-800">
                  Copy this key now. You won't be able to see it again.
                </span>
              </div>

              <div className="bg-slate-100 p-4 rounded-lg font-mono text-sm break-all">
                {newKeyValue}
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy Key'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowKeyModal(false);
                  setNewKeyValue(null);
                }}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

**6.5.12 Add Test Mocks**

Add to apps/api/tests/__mocks__/@zigznote/database.ts:

After the existing stores at the top, add:
```typescript
let apiKeysStore: Map<string, MockApiKey> = new Map();

interface MockApiKey {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  usageCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
```

Add the repository mock (before the `__resetMocks` function):
```typescript
export const userApiKeyRepository = {
  create: jest.fn(async (data: Partial<MockApiKey>) => {
    const key: MockApiKey = {
      id: generateId(),
      userId: data.userId || '',
      organizationId: data.organizationId || '',
      name: data.name || '',
      keyPrefix: data.keyPrefix || '',
      keyHash: data.keyHash || '',
      scopes: data.scopes || [],
      lastUsedAt: null,
      lastUsedIp: null,
      usageCount: 0,
      expiresAt: data.expiresAt || null,
      revokedAt: null,
      createdAt: new Date(),
    };
    apiKeysStore.set(key.id, key);
    return key;
  }),

  findById: jest.fn(async (id: string) => apiKeysStore.get(id) || null),

  findByUser: jest.fn(async (userId: string) =>
    Array.from(apiKeysStore.values()).filter(k => k.userId === userId && !k.revokedAt)
  ),

  findByPrefix: jest.fn(async (prefix: string) =>
    Array.from(apiKeysStore.values()).filter(k => k.keyPrefix === prefix)
  ),

  countByUser: jest.fn(async (userId: string) =>
    Array.from(apiKeysStore.values()).filter(k => k.userId === userId && !k.revokedAt).length
  ),

  recordUsage: jest.fn(async (id: string, ip?: string) => {
    const key = apiKeysStore.get(id);
    if (key) {
      key.lastUsedAt = new Date();
      key.lastUsedIp = ip || null;
      key.usageCount++;
    }
  }),

  revoke: jest.fn(async (id: string) => {
    const key = apiKeysStore.get(id);
    if (key) {
      key.revokedAt = new Date();
    }
  }),

  update: jest.fn(async (id: string, data: Partial<MockApiKey>) => {
    const key = apiKeysStore.get(id);
    if (!key) return null;
    Object.assign(key, data);
    return key;
  }),

  deleteExpired: jest.fn(async () => 0),
};
```

Update the `__resetMocks` function to include:
```typescript
export function __resetMocks() {
  meetingsStore.clear();
  transcriptsStore.clear();
  summariesStore.clear();
  actionItemsStore.clear();
  apiKeysStore.clear();  // ADD THIS LINE
  idCounter = 1;

  jest.clearAllMocks();
}
```

**6.5.13 API Key Tests**

Create apps/api/tests/apiKeys.test.ts:

```typescript
import request from 'supertest';
import { createApp } from '../src/app';

// Mock the database module
jest.mock('@zigznote/database');

// Mock the auth middleware to add auth info to requests
jest.mock('../src/middleware/auth', () => {
  const originalModule = jest.requireActual('../src/middleware/auth');
  return {
    ...originalModule,
    clerkAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireAuth: (req: { auth?: Record<string, string> }, _res: unknown, next: () => void) => {
      req.auth = {
        userId: 'test-user-id',
        clerkUserId: 'clerk-test-user-id',
        organizationId: 'test-org-id',
        email: 'test@example.com',
        role: 'member',
      };
      next();
    },
    optionalAuth: (req: { auth?: Record<string, string> }, _res: unknown, next: () => void) => {
      req.auth = {
        userId: 'test-user-id',
        clerkUserId: 'clerk-test-user-id',
        organizationId: 'test-org-id',
        email: 'test@example.com',
        role: 'member',
      };
      next();
    },
  };
});

describe('API Key Routes', () => {
  const app = createApp();

  describe('GET /api/v1/api-keys', () => {
    it('should return empty list initially', async () => {
      const response = await request(app)
        .get('/api/v1/api-keys');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/api-keys/scopes', () => {
    it('should return available scopes', async () => {
      const response = await request(app)
        .get('/api/v1/api-keys/scopes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toContainEqual(
        expect.objectContaining({ scope: 'meetings:read' })
      );
    });
  });

  describe('POST /api/v1/api-keys', () => {
    it('should create a new API key', async () => {
      const response = await request(app)
        .post('/api/v1/api-keys')
        .send({
          name: 'Test Key',
          scopes: ['meetings:read'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toMatch(/^sk_live_/);
      expect(response.body.data.name).toBe('Test Key');
      expect(response.body.data.scopes).toContain('meetings:read');
    });

    it('should reject invalid scopes', async () => {
      const response = await request(app)
        .post('/api/v1/api-keys')
        .send({
          name: 'Test Key',
          scopes: ['invalid:scope'],
        });

      expect(response.status).toBe(400);
    });

    it('should require at least one scope', async () => {
      const response = await request(app)
        .post('/api/v1/api-keys')
        .send({
          name: 'Test Key',
          scopes: [],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/api-keys/:keyId', () => {
    it('should revoke an API key', async () => {
      // First create a key
      const createResponse = await request(app)
        .post('/api/v1/api-keys')
        .send({
          name: 'To Delete',
          scopes: ['meetings:read'],
        });

      const keyId = createResponse.body.data.id;

      // Then revoke it
      const response = await request(app)
        .delete(`/api/v1/api-keys/${keyId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] `pnpm db:migrate` runs successfully
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm test` passes all tests including new API key tests
- [ ] API key creation returns full key once
- [ ] API key authentication works on /api/v1/meetings routes
- [ ] Scope enforcement works (missing scope returns 403)
- [ ] Revoked keys are rejected
- [ ] Frontend settings page displays at /settings/api-keys
- [ ] Can create and revoke keys from UI
- [ ] PHASES.md updated with Phase 6.5 status
- [ ] PHASE_6_5_COMPLETE.md created

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add user API keys for external integrations

- Add UserApiKey schema with scopes and expiration
- API key service with secure generation and bcrypt hashing
- API key auth middleware with scope enforcement  
- CRUD routes for key management (/api/v1/api-keys)
- Updated meetings routes to support dual auth (session + API key)
- Frontend settings page for key management
- Comprehensive tests for service and routes"
```

---

## Summary

After completing Phase 6.5:

| Feature | Status |
|---------|--------|
| User API key generation | ✅ |
| Secure key storage (bcrypt) | ✅ |
| Granular scopes | ✅ |
| Key expiration (optional) | ✅ |
| Key revocation | ✅ |
| Usage tracking | ✅ |
| Frontend management UI | ✅ |
| Dual auth (session + API key) | ✅ |

Ready for Phase 7: Admin Panel.
