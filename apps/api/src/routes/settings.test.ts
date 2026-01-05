/**
 * Settings Routes Tests
 */

import request from 'supertest';
import express from 'express';
import { settingsRouter } from './settings';
import { prisma } from '@zigznote/database';

// Mock Prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    notificationPreferences: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    organizationSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    usageRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock auth middleware
const mockAuth = jest.fn((req, _res, next) => {
  req.auth = { userId: 'clerk-user-123' };
  next();
});

const app = express();
app.use(express.json());
app.use(mockAuth);
app.use('/settings', settingsRouter);

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Settings Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /settings/notifications', () => {
    it('should return notification preferences', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPrisma.notificationPreferences.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        emailMeetingReady: true,
        emailActionItemReminder: true,
        emailWeeklyDigest: false,
        emailMeetingShared: true,
        emailPaymentAlerts: true,
        actionItemReminderDays: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/settings/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emailMeetingReady).toBe(true);
      expect(response.body.data.emailWeeklyDigest).toBe(false);
      expect(response.body.data.actionItemReminderDays).toBe(2);
    });

    it('should create default preferences if not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPrisma.notificationPreferences.findUnique.mockResolvedValue(null);
      mockPrisma.notificationPreferences.create.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        emailMeetingReady: true,
        emailActionItemReminder: true,
        emailWeeklyDigest: true,
        emailMeetingShared: true,
        emailPaymentAlerts: true,
        actionItemReminderDays: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/settings/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPrisma.notificationPreferences.create).toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await request(app)
        .get('/settings/notifications')
        .expect(404);
    });
  });

  describe('PATCH /settings/notifications', () => {
    it('should update notification preferences', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPrisma.notificationPreferences.upsert.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        emailMeetingReady: false,
        emailActionItemReminder: true,
        emailWeeklyDigest: false,
        emailMeetingShared: true,
        emailPaymentAlerts: true,
        actionItemReminderDays: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch('/settings/notifications')
        .send({
          emailMeetingReady: false,
          emailWeeklyDigest: false,
          actionItemReminderDays: 3,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emailMeetingReady).toBe(false);
      expect(response.body.data.actionItemReminderDays).toBe(3);
    });

    it('should validate actionItemReminderDays range', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await request(app)
        .patch('/settings/notifications')
        .send({
          actionItemReminderDays: 10, // Max is 7
        })
        .expect(400);
    });
  });

  describe('GET /settings/organization', () => {
    it('should return organization settings', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        organization: { id: 'org-1', name: 'Test Org' },
      });

      mockPrisma.organizationSettings.findUnique.mockResolvedValue({
        id: 'settings-1',
        organizationId: 'org-1',
        recordingConsentEnabled: true,
        consentAnnouncementText: 'This meeting is being recorded.',
        requireExplicitConsent: false,
        defaultBotName: 'zigznote Notetaker',
        joinAnnouncementEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/settings/organization')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recordingConsentEnabled).toBe(true);
      expect(response.body.data.defaultBotName).toBe('zigznote Notetaker');
    });
  });

  describe('PATCH /settings/organization', () => {
    it('should require admin role', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member', // Not admin
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await request(app)
        .patch('/settings/organization')
        .send({
          recordingConsentEnabled: false,
        })
        .expect(403);
    });

    it('should allow admin to update settings', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'admin',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPrisma.organizationSettings.upsert.mockResolvedValue({
        id: 'settings-1',
        organizationId: 'org-1',
        recordingConsentEnabled: false,
        consentAnnouncementText: 'Custom message',
        requireExplicitConsent: true,
        defaultBotName: 'Custom Bot',
        joinAnnouncementEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch('/settings/organization')
        .send({
          recordingConsentEnabled: false,
          consentAnnouncementText: 'Custom message',
          requireExplicitConsent: true,
          defaultBotName: 'Custom Bot',
          joinAnnouncementEnabled: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recordingConsentEnabled).toBe(false);
      expect(response.body.data.defaultBotName).toBe('Custom Bot');
    });
  });

  describe('GET /settings/usage', () => {
    it('should return usage summary', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        clerkId: 'clerk-user-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'member',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        plan: 'pro',
        clerkId: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        accountType: 'REGULAR',
        billingOverrideReason: null,
        billingOverrideBy: null,
        billingOverrideAt: null,
        accountNotes: null,
      });

      mockPrisma.usageRecord.findUnique.mockResolvedValue({
        id: 'usage-1',
        organizationId: 'org-1',
        period: '2026-01',
        meetingsCount: 25,
        meetingMinutes: 500,
        storageUsed: BigInt(1000000000),
        audioStorageUsed: BigInt(500000000),
        transcriptionMinutes: 400,
        summarizationTokens: 50000,
        chatTokens: 10000,
        apiRequests: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/settings/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('pro');
      expect(response.body.data.usage.meetings.current).toBe(25);
    });
  });
});
