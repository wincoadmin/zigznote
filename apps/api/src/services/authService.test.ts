/**
 * @file Auth Service Unit Tests
 * @description Tests for authentication and webhook handling operations
 */

import { authService, AuthService, ClerkWebhookEvent } from './authService';
import { userRepository, organizationRepository, prisma, __resetMocks } from '@zigznote/database';

// Mock the database
jest.mock('@zigznote/database');

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    __resetMocks();
    jest.clearAllMocks();
  });

  describe('syncUserFromWebhook', () => {
    describe('user.created event', () => {
      it('should skip creation if user already exists', async () => {
        const existingUser = { id: 'user-123', clerkId: 'clerk_user_123' };
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);

        const event: ClerkWebhookEvent = {
          type: 'user.created',
          data: {
            id: 'clerk_user_123',
            email_addresses: [{ email_address: 'test@example.com', id: 'email_1' }],
            first_name: 'Test',
            last_name: 'User',
            image_url: null,
            primary_email_address_id: 'email_1',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(userRepository.findByClerkId).toHaveBeenCalledWith('clerk_user_123');
        expect(userRepository.create).not.toHaveBeenCalled();
      });

      it('should log info when new user.created event is received', async () => {
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        const { logger } = require('../utils/logger');

        const event: ClerkWebhookEvent = {
          type: 'user.created',
          data: {
            id: 'clerk_new_user',
            email_addresses: [{ email_address: 'new@example.com', id: 'email_1' }],
            first_name: 'New',
            last_name: 'User',
            image_url: null,
            primary_email_address_id: 'email_1',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(logger.info).toHaveBeenCalledWith(
          { clerkId: 'clerk_new_user' },
          'Received user.created, waiting for membership'
        );
      });
    });

    describe('user.updated event', () => {
      it('should update existing user', async () => {
        const existingUser = {
          id: 'user-123',
          clerkId: 'clerk_user_123',
          email: 'old@example.com',
          name: 'Old Name',
          avatarUrl: null,
        };
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);

        const event: ClerkWebhookEvent = {
          type: 'user.updated',
          data: {
            id: 'clerk_user_123',
            email_addresses: [{ email_address: 'new@example.com', id: 'email_1' }],
            first_name: 'New',
            last_name: 'Name',
            image_url: 'https://example.com/avatar.jpg',
            primary_email_address_id: 'email_1',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(userRepository.update).toHaveBeenCalledWith('user-123', {
          email: 'new@example.com',
          name: 'New Name',
          avatarUrl: 'https://example.com/avatar.jpg',
        });
      });

      it('should log warning when user not found', async () => {
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        const { logger } = require('../utils/logger');

        const event: ClerkWebhookEvent = {
          type: 'user.updated',
          data: {
            id: 'clerk_unknown',
            email_addresses: [{ email_address: 'test@example.com', id: 'email_1' }],
            first_name: 'Test',
            last_name: 'User',
            image_url: null,
            primary_email_address_id: 'email_1',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(logger.warn).toHaveBeenCalledWith(
          { clerkId: 'clerk_unknown' },
          'User not found for update'
        );
        expect(userRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('user.deleted event', () => {
      it('should soft delete existing user', async () => {
        const existingUser = { id: 'user-123', clerkId: 'clerk_user_123' };
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);

        const event: ClerkWebhookEvent = {
          type: 'user.deleted',
          data: { id: 'clerk_user_123' },
        };

        await authService.syncUserFromWebhook(event);

        expect(userRepository.softDelete).toHaveBeenCalledWith('user-123');
      });

      it('should not fail when user not found', async () => {
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(null);

        const event: ClerkWebhookEvent = {
          type: 'user.deleted',
          data: { id: 'clerk_unknown' },
        };

        await expect(authService.syncUserFromWebhook(event)).resolves.not.toThrow();
      });
    });

    describe('organization.created event', () => {
      it('should create new organization', async () => {
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        (organizationRepository.create as jest.Mock).mockResolvedValue({
          id: 'org-123',
          clerkId: 'clerk_org_123',
          name: 'New Org',
        });

        const event: ClerkWebhookEvent = {
          type: 'organization.created',
          data: {
            id: 'clerk_org_123',
            name: 'New Org',
            slug: 'new-org',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(organizationRepository.create).toHaveBeenCalledWith({
          name: 'New Org',
          clerkId: 'clerk_org_123',
        });
      });

      it('should skip creation if organization already exists', async () => {
        const existingOrg = { id: 'org-123', clerkId: 'clerk_org_123' };
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(existingOrg);

        const event: ClerkWebhookEvent = {
          type: 'organization.created',
          data: {
            id: 'clerk_org_123',
            name: 'Existing Org',
            slug: 'existing-org',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(organizationRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('organization.updated event', () => {
      it('should update existing organization', async () => {
        const existingOrg = { id: 'org-123', clerkId: 'clerk_org_123', name: 'Old Name' };
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(existingOrg);

        const event: ClerkWebhookEvent = {
          type: 'organization.updated',
          data: {
            id: 'clerk_org_123',
            name: 'New Name',
            slug: 'new-name',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(organizationRepository.update).toHaveBeenCalledWith('org-123', {
          name: 'New Name',
        });
      });
    });

    describe('organization.deleted event', () => {
      it('should soft delete existing organization', async () => {
        const existingOrg = { id: 'org-123', clerkId: 'clerk_org_123' };
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(existingOrg);

        const event: ClerkWebhookEvent = {
          type: 'organization.deleted',
          data: { id: 'clerk_org_123' },
        };

        await authService.syncUserFromWebhook(event);

        expect(organizationRepository.softDelete).toHaveBeenCalledWith('org-123');
      });
    });

    describe('organizationMembership.created event', () => {
      it('should update user organization when both exist', async () => {
        const existingUser = { id: 'user-123', clerkId: 'clerk_user_123', organizationId: 'old-org' };
        const existingOrg = { id: 'org-new', clerkId: 'clerk_org_123' };

        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(existingOrg);

        const event: ClerkWebhookEvent = {
          type: 'organizationMembership.created',
          data: {
            id: 'membership_123',
            organization: { id: 'clerk_org_123', name: 'New Org' },
            public_user_data: { user_id: 'clerk_user_123' },
            role: 'admin',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(userRepository.update).toHaveBeenCalledWith('user-123', {
          organizationId: 'org-new',
          role: 'admin',
        });
      });

      it('should create organization if it does not exist', async () => {
        const existingUser = { id: 'user-123', clerkId: 'clerk_user_123', organizationId: 'old-org' };
        const newOrg = { id: 'org-new', clerkId: 'clerk_org_123', name: 'New Org' };

        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        (prisma.organization.create as jest.Mock).mockResolvedValue(newOrg);

        const event: ClerkWebhookEvent = {
          type: 'organizationMembership.created',
          data: {
            id: 'membership_123',
            organization: { id: 'clerk_org_123', name: 'New Org' },
            public_user_data: { user_id: 'clerk_user_123' },
            role: 'member',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(prisma.organization.create).toHaveBeenCalledWith({
          data: {
            name: 'New Org',
            clerkId: 'clerk_org_123',
            plan: 'free',
          },
        });
      });

      it('should log warning when user does not exist', async () => {
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        (organizationRepository.findByClerkId as jest.Mock).mockResolvedValue(null);
        (prisma.organization.create as jest.Mock).mockResolvedValue({
          id: 'org-123',
          clerkId: 'clerk_org_123',
        });

        const { logger } = require('../utils/logger');

        const event: ClerkWebhookEvent = {
          type: 'organizationMembership.created',
          data: {
            id: 'membership_123',
            organization: { id: 'clerk_org_123', name: 'New Org' },
            public_user_data: { user_id: 'clerk_unknown_user' },
            role: 'member',
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(logger.warn).toHaveBeenCalledWith(
          { clerkUserId: 'clerk_unknown_user', clerkOrgId: 'clerk_org_123' },
          expect.stringContaining('Cannot create user from membership webhook')
        );
      });
    });

    describe('organizationMembership.deleted event', () => {
      it('should soft delete user when removed from organization', async () => {
        const existingUser = { id: 'user-123', clerkId: 'clerk_user_123' };
        (userRepository.findByClerkId as jest.Mock).mockResolvedValue(existingUser);

        const event: ClerkWebhookEvent = {
          type: 'organizationMembership.deleted',
          data: {
            id: 'membership_123',
            organization: { id: 'clerk_org_123' },
            public_user_data: { user_id: 'clerk_user_123' },
          },
        };

        await authService.syncUserFromWebhook(event);

        expect(userRepository.softDelete).toHaveBeenCalledWith('user-123');
      });
    });
  });
});
