/**
 * Analytics Service Tests
 */

import { analyticsService } from './analyticsService';

// Mock Prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    meeting: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    actionItem: {
      groupBy: jest.fn(),
    },
    userEngagement: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userDailyMetrics: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      aggregate: jest.fn(),
    },
    orgDailyMetrics: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    achievement: {
      findMany: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@zigznote/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserDashboardStats', () => {
    it('should return user dashboard statistics', async () => {
      // Mock data
      (mockPrisma.meeting.count as jest.Mock)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(5) // this week
        .mockResolvedValueOnce(20); // this month

      (mockPrisma.meeting.aggregate as jest.Mock).mockResolvedValue({
        _sum: { durationSeconds: 36000 }, // 10 hours
      });

      (mockPrisma.actionItem.groupBy as jest.Mock).mockResolvedValue([
        { completed: false, _count: { id: 5 } },
        { completed: true, _count: { id: 15 } },
      ]);

      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue({
        currentStreak: 7,
        longestStreak: 14,
      });

      (mockPrisma.userDailyMetrics.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await analyticsService.getUserDashboardStats('user-1', 'org-1');

      expect(stats.totalMeetings).toBe(50);
      expect(stats.meetingsThisWeek).toBe(5);
      expect(stats.meetingsThisMonth).toBe(20);
      expect(stats.totalMeetingHours).toBe(10);
      expect(stats.actionItemsCreated).toBe(20);
      expect(stats.actionItemsCompleted).toBe(15);
      expect(stats.completionRate).toBe(75);
      expect(stats.currentStreak).toBe(7);
      expect(stats.longestStreak).toBe(14);
    });

    it('should handle zero meetings gracefully', async () => {
      (mockPrisma.meeting.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.meeting.aggregate as jest.Mock).mockResolvedValue({
        _sum: { durationSeconds: null },
      });
      (mockPrisma.actionItem.groupBy as jest.Mock).mockResolvedValue([]);
      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.userDailyMetrics.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await analyticsService.getUserDashboardStats('user-1', 'org-1');

      expect(stats.totalMeetings).toBe(0);
      expect(stats.totalMeetingHours).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.currentStreak).toBe(0);
    });
  });

  describe('updateUserStreak', () => {
    it('should create engagement for new user', async () => {
      (mockPrisma.userEngagement.upsert as jest.Mock).mockResolvedValue({
        lastActiveDate: null,
        currentStreak: 0,
        longestStreak: 0,
      });

      (mockPrisma.userEngagement.update as jest.Mock).mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
      });

      await analyticsService.updateUserStreak('user-1', 'org-1');

      expect(mockPrisma.userEngagement.upsert).toHaveBeenCalled();
      expect(mockPrisma.userEngagement.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentStreak: 1,
          longestStreak: 1,
        },
      });
    });
  });

  describe('getUserAchievements', () => {
    it('should return achievements with unlock status', async () => {
      (mockPrisma.achievement.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ach-1',
          code: 'first_meeting',
          name: 'First Meeting',
          description: 'Record your first meeting',
          icon: '🎬',
          category: 'onboarding',
          threshold: 1,
          points: 20,
        },
        {
          id: 'ach-2',
          code: 'meeting_10',
          name: 'Meeting Pro',
          description: 'Record 10 meetings',
          icon: '📅',
          category: 'milestone',
          threshold: 10,
          points: 30,
        },
      ]);

      (mockPrisma.userAchievement.findMany as jest.Mock).mockResolvedValue([
        { achievementId: 'ach-1', unlockedAt: new Date() },
      ]);

      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue({
        totalMeetings: 5,
        currentStreak: 3,
      });

      const achievements = await analyticsService.getUserAchievements('user-1');

      expect(achievements).toHaveLength(2);
      expect(achievements[0].unlocked).toBe(true);
      expect(achievements[1].unlocked).toBe(false);
      expect(achievements[1].progress).toBe(50); // 5/10 = 50%
    });
  });

  describe('getProductivityScore', () => {
    it('should calculate productivity score correctly', async () => {
      (mockPrisma.meeting.findMany as jest.Mock).mockResolvedValue([
        { durationSeconds: 3600, actionItems: [{ completed: true }] },
        { durationSeconds: 1800, actionItems: [] },
      ]);

      (mockPrisma.actionItem.groupBy as jest.Mock).mockResolvedValue([
        { completed: true, _count: { id: 8 } },
        { completed: false, _count: { id: 2 } },
      ]);

      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue({
        currentStreak: 15,
      });

      (mockPrisma.userDailyMetrics.aggregate as jest.Mock).mockResolvedValue({
        _sum: { meetingsRecorded: 2, actionItemsCompleted: 5 },
      });

      const score = await analyticsService.getProductivityScore('user-1', 'org-1');

      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.components.meetingEfficiency).toBeGreaterThanOrEqual(0);
      expect(score.components.actionItemCompletion).toBeGreaterThanOrEqual(0);
      expect(score.components.engagementStreak).toBeGreaterThanOrEqual(0);
      expect(['up', 'down', 'stable']).toContain(score.trend);
    });
  });

  describe('checkAndUnlockAchievements', () => {
    it('should unlock achievements when conditions are met', async () => {
      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue({
        totalMeetings: 10,
        currentStreak: 7,
        totalActionItems: 10,
        totalHoursSaved: 5,
        onboardingCompleted: true,
      });

      (mockPrisma.userAchievement.findMany as jest.Mock).mockResolvedValue([]);

      (mockPrisma.achievement.findMany as jest.Mock).mockResolvedValue([
        { id: 'ach-1', code: 'first_meeting', name: 'First Meeting', description: '', icon: '', category: '', threshold: 1, points: 10 },
        { id: 'ach-2', code: 'meeting_10', name: 'Meeting Pro', description: '', icon: '', category: '', threshold: 10, points: 30 },
        { id: 'ach-3', code: 'streak_7', name: 'Week Warrior', description: '', icon: '', category: '', threshold: 7, points: 30 },
      ]);

      (mockPrisma.userAchievement.create as jest.Mock).mockResolvedValue({});

      const newlyUnlocked = await analyticsService.checkAndUnlockAchievements('user-1', 'org-1');

      expect(newlyUnlocked.length).toBe(3);
      expect(mockPrisma.userAchievement.create).toHaveBeenCalledTimes(3);
    });

    it('should not unlock already unlocked achievements', async () => {
      (mockPrisma.userEngagement.findUnique as jest.Mock).mockResolvedValue({
        totalMeetings: 10,
        currentStreak: 7,
      });

      (mockPrisma.userAchievement.findMany as jest.Mock).mockResolvedValue([
        { achievementId: 'ach-1' },
        { achievementId: 'ach-2' },
      ]);

      (mockPrisma.achievement.findMany as jest.Mock).mockResolvedValue([
        { id: 'ach-1', code: 'first_meeting' },
        { id: 'ach-2', code: 'meeting_10' },
      ]);

      const newlyUnlocked = await analyticsService.checkAndUnlockAchievements('user-1', 'org-1');

      expect(newlyUnlocked.length).toBe(0);
      expect(mockPrisma.userAchievement.create).not.toHaveBeenCalled();
    });
  });
});
