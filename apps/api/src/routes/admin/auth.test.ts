/**
 * Admin authentication routes tests
 */

import request from 'supertest';
import { createApp } from '../../app';
import { adminUserRepository, adminSessionRepository, auditLogRepository } from '@zigznote/database';
import { adminAuthService } from '../../services/adminAuthService';

// Mock dependencies
jest.mock('@zigznote/database', () => ({
  adminUserRepository: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    hasAnyAdmins: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    recordSuccessfulLogin: jest.fn(),
  },
  adminSessionRepository: {
    create: jest.fn(),
    validateSession: jest.fn(),
    deleteByToken: jest.fn(),
  },
  auditLogRepository: {
    create: jest.fn(),
  },
}));

// Mock adminAuthService
jest.mock('../../services/adminAuthService', () => ({
  adminAuthService: {
    login: jest.fn(),
    verify2FA: jest.fn(),
    validateSession: jest.fn(),
    logout: jest.fn(),
    needsInitialSetup: jest.fn(),
    createInitialAdmin: jest.fn(),
  },
}));

const mockAdminAuthService = adminAuthService as jest.Mocked<typeof adminAuthService>;

const mockAdminUserRepo = adminUserRepository as jest.Mocked<typeof adminUserRepository>;
const mockAdminSessionRepo = adminSessionRepository as jest.Mocked<typeof adminSessionRepository>;
const mockAuditLogRepo = auditLogRepository as jest.Mocked<typeof auditLogRepository>;

describe('Admin Auth Routes', () => {
  const app = createApp();
  const mockAdmin = {
    id: 'admin-123',
    email: 'admin@test.com',
    passwordHash: '$2a$12$test.hash', // bcrypt hash
    name: 'Test Admin',
    role: 'admin',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    backupCodes: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    passwordChangedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogRepo.create.mockResolvedValue({} as never);
  });

  describe('GET /api/admin/auth/setup-status', () => {
    it('should return needsSetup: true when no admins exist', async () => {
      mockAdminAuthService.needsInitialSetup.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/admin/auth/setup-status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { needsSetup: true },
      });
    });

    it('should return needsSetup: false when admins exist', async () => {
      mockAdminAuthService.needsInitialSetup.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/admin/auth/setup-status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { needsSetup: false },
      });
    });
  });

  describe('POST /api/admin/auth/initial-setup', () => {
    it('should create initial admin when no admins exist', async () => {
      mockAdminAuthService.createInitialAdmin.mockResolvedValue(mockAdmin);

      const response = await request(app)
        .post('/api/admin/auth/initial-setup')
        .send({
          email: 'admin@test.com',
          password: 'SecurePassword123!',
          name: 'Test Admin',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('admin@test.com');
      expect(response.body.data.role).toBe('admin');
    });

    it('should reject when admins already exist', async () => {
      const { ForbiddenError } = jest.requireActual('@zigznote/shared');
      mockAdminAuthService.createInitialAdmin.mockRejectedValue(
        new ForbiddenError('Admin setup already complete')
      );

      const response = await request(app)
        .post('/api/admin/auth/initial-setup')
        .send({
          email: 'admin@test.com',
          password: 'SecurePassword123!',
          name: 'Test Admin',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

  });

  describe('POST /api/admin/auth/login', () => {
    it('should reject invalid email', async () => {
      const { UnauthorizedError } = jest.requireActual('@zigznote/shared');
      mockAdminAuthService.login.mockRejectedValue(
        new UnauthorizedError('Invalid email or password')
      );

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'unknown@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject inactive account', async () => {
      const { UnauthorizedError } = jest.requireActual('@zigznote/shared');
      mockAdminAuthService.login.mockRejectedValue(
        new UnauthorizedError('Account is inactive')
      );

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject locked account', async () => {
      const { ForbiddenError } = jest.requireActual('@zigznote/shared');
      mockAdminAuthService.login.mockRejectedValue(
        new ForbiddenError('Account is locked. Please try again later.')
      );

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('locked');
    });
  });

  describe('GET /api/admin/auth/me', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/admin/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return admin info with valid token', async () => {
      mockAdminAuthService.validateSession.mockResolvedValue({
        adminId: 'admin-123',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/admin/auth/me')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('admin@test.com');
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('should clear session on logout', async () => {
      mockAdminAuthService.validateSession.mockResolvedValue({
        adminId: 'admin-123',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        sessionId: 'session-123',
      });
      mockAdminAuthService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAdminAuthService.logout).toHaveBeenCalled();
    });
  });
});
