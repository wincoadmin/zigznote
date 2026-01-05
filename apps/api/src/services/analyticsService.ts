/**
 * Analytics Service
 * Handles user metrics, engagement tracking, achievements, and analytics data
 *
 * @module services/analyticsService
 */

import { prisma } from '@zigznote/database';

// ============================================
// Types
// ============================================

export interface UserDashboardStats {
  // Meeting overview
  totalMeetings: number;
  meetingsThisWeek: number;
  meetingsThisMonth: number;

  // Time metrics
  totalMeetingHours: number;
  hoursSavedEstimate: number;

  // Productivity
  actionItemsCreated: number;
  actionItemsCompleted: number;
  completionRate: number;

  // Engagement
  currentStreak: number;
  longestStreak: number;

  // Trends (last 7 days)
  dailyMeetings: { date: string; count: number }[];
}

export interface OrgAnalyticsStats {
  // Overview
  totalMeetings: number;
  totalUsers: number;
  activeUsers: number;

  // This period
  meetingsThisMonth: number;
  newUsersThisMonth: number;

  // Usage
  totalMeetingMinutes: number;
  meetingsBySource: { source: string; count: number }[];

  // Cost
  totalCost: number;
  costByCategory: { category: string; amount: number }[];

  // Trends
  dailyMeetings: { date: string; count: number }[];
  dailyActiveUsers: { date: string; count: number }[];
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
}

export interface ProductivityScore {
  score: number; // 0-100
  components: {
    meetingEfficiency: number;
    actionItemCompletion: number;
    engagementStreak: number;
  };
  trend: 'up' | 'down' | 'stable';
}

// ============================================
// Constants
// ============================================

// Estimated time saved per meeting hour (in minutes)
const TIME_SAVED_MULTIPLIER = 15;

// ============================================
// Analytics Service
// ============================================

class AnalyticsService {
  /**
   * Get user dashboard statistics
   */
  async getUserDashboardStats(
    userId: string,
    organizationId: string
  ): Promise<UserDashboardStats> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Fetch all metrics in parallel
    const [
      totalMeetings,
      meetingsThisWeek,
      meetingsThisMonth,
      totalDuration,
      actionItemStats,
      engagement,
      dailyMetrics,
    ] = await Promise.all([
      // Total meetings
      prisma.meeting.count({
        where: {
          createdById: userId,
          organizationId,
          deletedAt: null,
          status: 'completed',
        },
      }),

      // Meetings this week
      prisma.meeting.count({
        where: {
          createdById: userId,
          organizationId,
          deletedAt: null,
          status: 'completed',
          startTime: { gte: startOfWeek },
        },
      }),

      // Meetings this month
      prisma.meeting.count({
        where: {
          createdById: userId,
          organizationId,
          deletedAt: null,
          status: 'completed',
          startTime: { gte: startOfMonth },
        },
      }),

      // Total duration (in seconds)
      prisma.meeting.aggregate({
        where: {
          createdById: userId,
          organizationId,
          deletedAt: null,
          status: 'completed',
        },
        _sum: {
          durationSeconds: true,
        },
      }),

      // Action items
      prisma.actionItem.groupBy({
        by: ['completed'],
        where: {
          meeting: {
            createdById: userId,
            organizationId,
          },
        },
        _count: {
          id: true,
        },
      }),

      // User engagement
      prisma.userEngagement.findUnique({
        where: { userId },
      }),

      // Daily metrics for last 7 days
      prisma.userDailyMetrics.findMany({
        where: {
          userId,
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Calculate action item stats
    const totalActionItems = actionItemStats.reduce(
      (sum, item) => sum + item._count.id,
      0
    );
    const completedActionItems =
      actionItemStats.find((item) => item.completed)?._count.id || 0;
    const completionRate =
      totalActionItems > 0 ? (completedActionItems / totalActionItems) * 100 : 0;

    // Calculate time metrics
    const totalSeconds = totalDuration._sum.durationSeconds || 0;
    const totalMeetingHours = Math.round((totalSeconds / 3600) * 10) / 10;
    const hoursSavedEstimate =
      Math.round(((totalSeconds / 60) * TIME_SAVED_MULTIPLIER) / 60 * 10) / 10;

    // Build daily meetings array
    const dailyMeetings: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;

      const dayMetrics = dailyMetrics.find(
        (m) => m.date.toISOString().split('T')[0] === dateStr
      );

      dailyMeetings.push({
        date: dateStr,
        count: dayMetrics?.meetingsRecorded || 0,
      });
    }

    return {
      totalMeetings,
      meetingsThisWeek,
      meetingsThisMonth,
      totalMeetingHours,
      hoursSavedEstimate,
      actionItemsCreated: totalActionItems,
      actionItemsCompleted: completedActionItems,
      completionRate: Math.round(completionRate),
      currentStreak: engagement?.currentStreak || 0,
      longestStreak: engagement?.longestStreak || 0,
      dailyMeetings,
    };
  }

  /**
   * Get organization analytics
   */
  async getOrgAnalyticsStats(organizationId: string): Promise<OrgAnalyticsStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      totalMeetings,
      totalUsers,
      activeUsersCount,
      meetingsThisMonth,
      newUsersThisMonth,
      totalMinutes,
      meetingsBySource,
      costMetrics,
      dailyOrgMetrics,
    ] = await Promise.all([
      // Total meetings
      prisma.meeting.count({
        where: { organizationId, deletedAt: null },
      }),

      // Total users
      prisma.user.count({
        where: { organizationId, deletedAt: null },
      }),

      // Active users (in last 30 days)
      prisma.userEngagement.count({
        where: {
          organizationId,
          lastActiveDate: { gte: thirtyDaysAgo },
        },
      }),

      // Meetings this month
      prisma.meeting.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),

      // New users this month
      prisma.user.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),

      // Total meeting minutes
      prisma.meeting.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { durationSeconds: true },
      }),

      // Meetings by source
      prisma.meeting.groupBy({
        by: ['source'],
        where: { organizationId, deletedAt: null },
        _count: { id: true },
      }),

      // Cost metrics for this month
      prisma.orgDailyMetrics.aggregate({
        where: {
          organizationId,
          date: { gte: startOfMonth },
        },
        _sum: {
          transcriptionCost: true,
          summarizationCost: true,
          storageCost: true,
        },
      }),

      // Daily org metrics for last 30 days
      prisma.orgDailyMetrics.findMany({
        where: {
          organizationId,
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Calculate costs
    const transcriptionCost = costMetrics._sum.transcriptionCost || 0;
    const summarizationCost = costMetrics._sum.summarizationCost || 0;
    const storageCost = costMetrics._sum.storageCost || 0;
    const totalCost = transcriptionCost + summarizationCost + storageCost;

    // Format meetings by source
    const meetingsBySourceFormatted = meetingsBySource.map((item) => ({
      source: item.source,
      count: item._count.id,
    }));

    // Format cost by category
    const costByCategory = [
      { category: 'Transcription', amount: transcriptionCost },
      { category: 'Summarization', amount: summarizationCost },
      { category: 'Storage', amount: storageCost },
    ].filter((item) => item.amount > 0);

    // Build daily charts data
    const dailyMeetings: { date: string; count: number }[] = [];
    const dailyActiveUsers: { date: string; count: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;

      const dayMetrics = dailyOrgMetrics.find(
        (m) => m.date.toISOString().split('T')[0] === dateStr
      );

      dailyMeetings.push({
        date: dateStr,
        count: dayMetrics?.totalMeetings || 0,
      });

      dailyActiveUsers.push({
        date: dateStr,
        count: dayMetrics?.activeUsers || 0,
      });
    }

    return {
      totalMeetings,
      totalUsers,
      activeUsers: activeUsersCount,
      meetingsThisMonth,
      newUsersThisMonth,
      totalMeetingMinutes: Math.round(
        (totalMinutes._sum.durationSeconds || 0) / 60
      ),
      meetingsBySource: meetingsBySourceFormatted,
      totalCost: totalCost / 100, // Convert cents to dollars
      costByCategory: costByCategory.map((item) => ({
        ...item,
        amount: item.amount / 100, // Convert cents to dollars
      })),
      dailyMeetings,
      dailyActiveUsers,
    };
  }

  /**
   * Update user streak
   */
  async updateUserStreak(userId: string, organizationId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const engagement = await prisma.userEngagement.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
      },
      update: {
        lastActiveDate: today,
      },
    });

    if (!engagement.lastActiveDate) {
      // First activity
      await prisma.userEngagement.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: 1,
        },
      });
      return;
    }

    const lastActive = new Date(engagement.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastActive.getTime() === yesterday.getTime()) {
      // Consecutive day - extend streak
      const newStreak = engagement.currentStreak + 1;
      await prisma.userEngagement.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, engagement.longestStreak),
        },
      });
    } else if (lastActive.getTime() < yesterday.getTime()) {
      // Streak broken - reset
      await prisma.userEngagement.update({
        where: { userId },
        data: {
          currentStreak: 1,
        },
      });
    }
    // If same day, no update needed
  }

  /**
   * Record daily metrics for a user
   */
  async recordUserDailyMetric(
    userId: string,
    organizationId: string,
    metric: keyof Pick<
      typeof prisma.userDailyMetrics.fields,
      | 'meetingsRecorded'
      | 'meetingsFromBot'
      | 'meetingsFromUpload'
      | 'meetingsFromBrowser'
      | 'actionItemsCreated'
      | 'actionItemsCompleted'
      | 'summariesViewed'
      | 'transcriptsViewed'
      | 'searchesPerformed'
    >,
    increment: number = 1
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.userDailyMetrics.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        organizationId,
        date: today,
        [metric]: increment,
      },
      update: {
        [metric]: {
          increment,
        },
      },
    });

    // Also update streak
    await this.updateUserStreak(userId, organizationId);
  }

  /**
   * Record meeting duration metrics
   */
  async recordMeetingDuration(
    userId: string,
    organizationId: string,
    durationSeconds: number
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.userDailyMetrics.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        organizationId,
        date: today,
        totalMeetingDuration: durationSeconds,
      },
      update: {
        totalMeetingDuration: {
          increment: durationSeconds,
        },
      },
    });
  }

  /**
   * Get user achievements with progress
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    const [allAchievements, userAchievements, engagement] = await Promise.all([
      prisma.achievement.findMany({
        orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
      prisma.userEngagement.findUnique({
        where: { userId },
      }),
    ]);

    const unlockedMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt])
    );

    return allAchievements.map((achievement) => {
      const unlocked = unlockedMap.has(achievement.id);
      let progress: number | undefined;

      // Calculate progress for some achievement types
      if (!unlocked && engagement) {
        switch (achievement.code) {
          case 'first_meeting':
            progress = Math.min((engagement.totalMeetings / 1) * 100, 100);
            break;
          case 'meeting_10':
            progress = Math.min((engagement.totalMeetings / 10) * 100, 100);
            break;
          case 'meeting_50':
            progress = Math.min((engagement.totalMeetings / 50) * 100, 100);
            break;
          case 'meeting_100':
            progress = Math.min((engagement.totalMeetings / 100) * 100, 100);
            break;
          case 'streak_7':
            progress = Math.min((engagement.currentStreak / 7) * 100, 100);
            break;
          case 'streak_30':
            progress = Math.min((engagement.currentStreak / 30) * 100, 100);
            break;
          default:
            progress = undefined;
        }
      }

      return {
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        threshold: achievement.threshold,
        points: achievement.points,
        unlocked,
        unlockedAt: unlockedMap.get(achievement.id),
        progress: unlocked ? 100 : progress,
      };
    });
  }

  /**
   * Check and unlock achievements for a user
   */
  async checkAndUnlockAchievements(
    userId: string,
    _organizationId: string
  ): Promise<Achievement[]> {
    const [engagement, unlockedIds] = await Promise.all([
      prisma.userEngagement.findUnique({
        where: { userId },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      }),
    ]);

    if (!engagement) return [];

    const unlockedSet = new Set(unlockedIds.map((ua) => ua.achievementId));

    // Get achievements to check
    const achievements = await prisma.achievement.findMany();
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of achievements) {
      if (unlockedSet.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.code) {
        case 'first_meeting':
          shouldUnlock = engagement.totalMeetings >= 1;
          break;
        case 'meeting_10':
          shouldUnlock = engagement.totalMeetings >= 10;
          break;
        case 'meeting_50':
          shouldUnlock = engagement.totalMeetings >= 50;
          break;
        case 'meeting_100':
          shouldUnlock = engagement.totalMeetings >= 100;
          break;
        case 'streak_7':
          shouldUnlock = engagement.currentStreak >= 7;
          break;
        case 'streak_30':
          shouldUnlock = engagement.currentStreak >= 30;
          break;
        case 'action_10':
          shouldUnlock = engagement.totalActionItems >= 10;
          break;
        case 'action_50':
          shouldUnlock = engagement.totalActionItems >= 50;
          break;
        case 'time_saved_10':
          shouldUnlock = engagement.totalHoursSaved >= 10;
          break;
        case 'time_saved_50':
          shouldUnlock = engagement.totalHoursSaved >= 50;
          break;
        case 'onboarding_complete':
          shouldUnlock = engagement.onboardingCompleted;
          break;
        default:
          break;
      }

      if (shouldUnlock) {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
          },
        });

        newlyUnlocked.push({
          id: achievement.id,
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          threshold: achievement.threshold,
          points: achievement.points,
          unlocked: true,
          unlockedAt: new Date(),
          progress: 100,
        });
      }
    }

    return newlyUnlocked;
  }

  /**
   * Calculate productivity score for a user
   */
  async getProductivityScore(
    userId: string,
    organizationId: string
  ): Promise<ProductivityScore> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [meetings, actionItems, engagement, previousMetrics] =
      await Promise.all([
        // Recent meetings
        prisma.meeting.findMany({
          where: {
            createdById: userId,
            organizationId,
            deletedAt: null,
            status: 'completed',
            startTime: { gte: thirtyDaysAgo },
          },
          select: {
            durationSeconds: true,
            actionItems: {
              select: { completed: true },
            },
          },
        }),

        // Total action items stats
        prisma.actionItem.groupBy({
          by: ['completed'],
          where: {
            meeting: { createdById: userId, organizationId },
          },
          _count: { id: true },
        }),

        // Engagement data
        prisma.userEngagement.findUnique({
          where: { userId },
        }),

        // Previous period metrics (30-60 days ago)
        prisma.userDailyMetrics.aggregate({
          where: {
            userId,
            date: {
              gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
              lt: thirtyDaysAgo,
            },
          },
          _sum: {
            meetingsRecorded: true,
            actionItemsCompleted: true,
          },
        }),
      ]);

    // Calculate meeting efficiency (meetings with action items / total meetings)
    const meetingsWithActions = meetings.filter(
      (m) => m.actionItems.length > 0
    ).length;
    const meetingEfficiency =
      meetings.length > 0 ? (meetingsWithActions / meetings.length) * 100 : 50;

    // Calculate action item completion rate
    const totalActions = actionItems.reduce(
      (sum, item) => sum + item._count.id,
      0
    );
    const completedActions =
      actionItems.find((item) => item.completed)?._count.id || 0;
    const actionItemCompletion =
      totalActions > 0 ? (completedActions / totalActions) * 100 : 50;

    // Calculate streak score (current streak / 30 * 100, capped at 100)
    const streakScore = Math.min(
      ((engagement?.currentStreak || 0) / 30) * 100,
      100
    );

    // Calculate overall score (weighted average)
    const score = Math.round(
      meetingEfficiency * 0.35 +
        actionItemCompletion * 0.35 +
        streakScore * 0.3
    );

    // Determine trend
    const currentMeetings = meetings.length;
    const previousMeetings = previousMetrics._sum.meetingsRecorded || 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (currentMeetings > previousMeetings * 1.1) {
      trend = 'up';
    } else if (currentMeetings < previousMeetings * 0.9) {
      trend = 'down';
    }

    return {
      score,
      components: {
        meetingEfficiency: Math.round(meetingEfficiency),
        actionItemCompletion: Math.round(actionItemCompletion),
        engagementStreak: Math.round(streakScore),
      },
      trend,
    };
  }

  /**
   * Get users for weekly digest
   */
  async getUsersForWeeklyDigest(): Promise<
    Array<{
      id: string;
      email: string;
      name: string | null;
      organizationId: string;
    }>
  > {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const engagements = await prisma.userEngagement.findMany({
      where: {
        weeklyDigestEnabled: true,
        OR: [
          { lastDigestSentAt: null },
          { lastDigestSentAt: { lt: oneWeekAgo } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });

    return engagements.map((e) => ({
      id: e.user.id,
      email: e.user.email,
      name: e.user.name,
      organizationId: e.user.organizationId,
    }));
  }

  /**
   * Mark weekly digest as sent
   */
  async markDigestSent(userId: string): Promise<void> {
    await prisma.userEngagement.update({
      where: { userId },
      data: { lastDigestSentAt: new Date() },
    });
  }

  /**
   * Get weekly digest data for a user
   */
  async getWeeklyDigestData(userId: string): Promise<{
    meetingsThisWeek: number;
    actionItemsCompleted: number;
    hoursSaved: number;
    streak: number;
    topAchievement: string | null;
  }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [metrics, engagement, recentAchievement] = await Promise.all([
      prisma.userDailyMetrics.aggregate({
        where: {
          userId,
          date: { gte: oneWeekAgo },
        },
        _sum: {
          meetingsRecorded: true,
          actionItemsCompleted: true,
          totalMeetingDuration: true,
        },
      }),
      prisma.userEngagement.findUnique({
        where: { userId },
      }),
      prisma.userAchievement.findFirst({
        where: {
          userId,
          unlockedAt: { gte: oneWeekAgo },
        },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
    ]);

    const hoursSaved =
      Math.round(
        (((metrics._sum.totalMeetingDuration || 0) / 60) *
          TIME_SAVED_MULTIPLIER) /
          60
      * 10) / 10;

    return {
      meetingsThisWeek: metrics._sum.meetingsRecorded || 0,
      actionItemsCompleted: metrics._sum.actionItemsCompleted || 0,
      hoursSaved,
      streak: engagement?.currentStreak || 0,
      topAchievement: recentAchievement?.achievement.name || null,
    };
  }

  /**
   * Increment total meetings count for engagement
   */
  async incrementMeetingCount(
    userId: string,
    organizationId: string
  ): Promise<void> {
    await prisma.userEngagement.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        totalMeetings: 1,
      },
      update: {
        totalMeetings: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Update hours saved estimate
   */
  async updateHoursSaved(
    userId: string,
    meetingDurationSeconds: number
  ): Promise<void> {
    const hoursSaved =
      (meetingDurationSeconds / 60) * TIME_SAVED_MULTIPLIER / 60;

    await prisma.userEngagement.update({
      where: { userId },
      data: {
        totalHoursSaved: {
          increment: hoursSaved,
        },
      },
    });
  }
}

export const analyticsService = new AnalyticsService();
