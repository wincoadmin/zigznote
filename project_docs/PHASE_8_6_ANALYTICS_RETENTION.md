# Phase 8.6: Analytics, Dashboards & Retention

**Goal:** Build rich analytics dashboards and retention features to increase user engagement, reduce churn, and provide actionable insights.

**Model:** Default

---

## Pre-Phase Checklist

- [ ] Read PHASE_8_5_COMPLETE.md (or latest completed phase)
- [ ] Read project_docs/GOVERNANCE.md
- [ ] Verify current tests pass: `pnpm test`

---

## Mandatory Updates (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_8_6_COMPLETE.md with summary and key decisions
2. **Update project_docs/PHASES.md**:
   - Add Phase 8.6 section after Phase 8.5
   - Add row to Summary Table: `| 8.6 | Analytics & Retention | ✅ | 90-120 min |`
   - Update Total Estimated Time
   - Add entry to Change Log
3. Run all tests and record coverage

---

## Why This Matters

**Retention is everything in SaaS:**
- Users who see value in data stay longer
- Rich dashboards justify the subscription cost
- Engagement features create habits
- Analytics help users improve (and credit your product)

**Competitor benchmark:** Circleback, Fireflies, Otter all have rich analytics. We need parity or better.

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md

=== TASK LIST (Execute All) ===

---

## SECTION A: Database Schema for Analytics

**8.6.1 Analytics Schema**

Add to packages/database/prisma/schema.prisma:

```prisma
// ============================================
// Analytics & Engagement
// ============================================

// Daily aggregated metrics per user
model UserDailyMetrics {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  organizationId String   @map("organization_id")
  date           DateTime @db.Date
  
  // Meeting metrics
  meetingsRecorded    Int @default(0) @map("meetings_recorded")
  meetingsFromBot     Int @default(0) @map("meetings_from_bot")
  meetingsFromUpload  Int @default(0) @map("meetings_from_upload")
  meetingsFromBrowser Int @default(0) @map("meetings_from_browser")
  
  // Time metrics (in seconds)
  totalMeetingDuration Int @default(0) @map("total_meeting_duration")
  totalSpeakingTime    Int @default(0) @map("total_speaking_time")
  
  // Productivity metrics
  actionItemsCreated   Int @default(0) @map("action_items_created")
  actionItemsCompleted Int @default(0) @map("action_items_completed")
  
  // Engagement metrics
  summariesViewed    Int @default(0) @map("summaries_viewed")
  transcriptsViewed  Int @default(0) @map("transcripts_viewed")
  searchesPerformed  Int @default(0) @map("searches_performed")
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@index([organizationId, date])
  @@index([date])
  @@map("user_daily_metrics")
}

// Organization-level daily metrics
model OrgDailyMetrics {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  date           DateTime @db.Date
  
  // Meeting metrics
  totalMeetings       Int @default(0) @map("total_meetings")
  meetingsFromBot     Int @default(0) @map("meetings_from_bot")
  meetingsFromUpload  Int @default(0) @map("meetings_from_upload")
  meetingsFromBrowser Int @default(0) @map("meetings_from_browser")
  
  // User engagement
  activeUsers         Int @default(0) @map("active_users")
  newUsers            Int @default(0) @map("new_users")
  
  // Usage metrics
  totalMeetingMinutes Int @default(0) @map("total_meeting_minutes")
  apiKeyRequests      Int @default(0) @map("api_key_requests")
  webhookDeliveries   Int @default(0) @map("webhook_deliveries")
  
  // Cost tracking (in cents)
  transcriptionCost   Int @default(0) @map("transcription_cost")
  summarizationCost   Int @default(0) @map("summarization_cost")
  storageCost         Int @default(0) @map("storage_cost")
  
  createdAt DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, date])
  @@index([date])
  @@map("org_daily_metrics")
}

// User engagement tracking for retention
model UserEngagement {
  id             String    @id @default(uuid())
  userId         String    @unique @map("user_id")
  organizationId String    @map("organization_id")
  
  // Streaks
  currentStreak      Int       @default(0) @map("current_streak") // Days in a row with activity
  longestStreak      Int       @default(0) @map("longest_streak")
  lastActiveDate     DateTime? @map("last_active_date")
  
  // Milestones
  totalMeetings      Int       @default(0) @map("total_meetings")
  totalActionItems   Int       @default(0) @map("total_action_items")
  totalHoursSaved    Float     @default(0) @map("total_hours_saved") // Estimated time saved
  
  // Onboarding
  onboardingCompleted Boolean   @default(false) @map("onboarding_completed")
  onboardingStep      Int       @default(0) @map("onboarding_step")
  
  // Notifications
  weeklyDigestEnabled  Boolean  @default(true) @map("weekly_digest_enabled")
  lastDigestSentAt     DateTime? @map("last_digest_sent_at")
  inactivityReminderAt DateTime? @map("inactivity_reminder_at")
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  achievements UserAchievement[]

  @@index([organizationId])
  @@index([lastActiveDate])
  @@map("user_engagement")
}

// Achievements/badges for gamification
model Achievement {
  id          String   @id @default(uuid())
  code        String   @unique // "first_meeting", "streak_7", "power_user"
  name        String   // "First Meeting"
  description String   // "Record your first meeting"
  icon        String   // Emoji or icon name
  category    String   // "onboarding", "streak", "milestone", "power_user"
  threshold   Int      @default(1) // Value needed to unlock
  points      Int      @default(10) // Gamification points
  
  createdAt DateTime @default(now()) @map("created_at")

  userAchievements UserAchievement[]

  @@map("achievements")
}

model UserAchievement {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  achievementId String   @map("achievement_id")
  unlockedAt    DateTime @default(now()) @map("unlocked_at")
  
  engagement  UserEngagement @relation(fields: [userId], references: [userId], onDelete: Cascade)
  achievement Achievement    @relation(fields: [achievementId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementId])
  @@map("user_achievements")
}

// Meeting-level analytics (for detailed insights)
model MeetingAnalytics {
  id        String @id @default(uuid())
  meetingId String @unique @map("meeting_id")
  
  // Participation
  participantCount   Int   @default(0) @map("participant_count")
  speakerCount       Int   @default(0) @map("speaker_count")
  
  // Speaking distribution (JSON: { "Speaker 0": 45.2, "Speaker 1": 32.1, ... })
  speakingDistribution Json? @map("speaking_distribution")
  
  // Sentiment (from AI analysis)
  overallSentiment   String? @map("overall_sentiment") // "positive", "neutral", "negative"
  sentimentScore     Float?  @map("sentiment_score") // -1.0 to 1.0
  
  // Efficiency metrics
  actionItemsPerMinute Float? @map("action_items_per_minute")
  decisionsCount       Int    @default(0) @map("decisions_count")
  questionsCount       Int    @default(0) @map("questions_count")
  
  // Topics (from AI extraction)
  topicsDiscussed Json? @map("topics_discussed") // ["budget", "timeline", "hiring"]
  
  // Quality indicators
  transcriptConfidence Float? @map("transcript_confidence") // Average confidence
  
  createdAt DateTime @default(now()) @map("created_at")

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@map("meeting_analytics")
}
```

Update User model to add relation:
```prisma
model User {
  // ... existing fields ...
  engagement UserEngagement?
}
```

Update Organization model:
```prisma
model Organization {
  // ... existing fields ...
  dailyMetrics    OrgDailyMetrics[]
  userEngagements UserEngagement[]
}
```

Update Meeting model:
```prisma
model Meeting {
  // ... existing fields ...
  analytics MeetingAnalytics?
}
```

Run migration:
```bash
pnpm db:migrate --name add_analytics_engagement
```

---

## SECTION B: Analytics Service Layer

**8.6.2 Analytics Service**

Create apps/api/src/services/analyticsService.ts:

```typescript
/**
 * @ownership
 * @domain Analytics & Metrics
 * @description Aggregates and serves analytics data for dashboards
 * @single-responsibility YES — all analytics operations
 */

import { prisma } from '@zigznote/database';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UserDashboardData {
  summary: {
    totalMeetings: number;
    totalHours: number;
    actionItemsCompleted: number;
    completionRate: number;
    currentStreak: number;
  };
  trends: {
    meetingsPerDay: Array<{ date: string; count: number }>;
    productivityScore: Array<{ date: string; score: number }>;
  };
  insights: {
    busiestDay: string;
    avgMeetingLength: number;
    topCollaborators: Array<{ name: string; meetingCount: number }>;
    timeSavedHours: number;
  };
  recentAchievements: Array<{
    code: string;
    name: string;
    icon: string;
    unlockedAt: Date;
  }>;
}

export interface OrgDashboardData {
  summary: {
    totalMeetings: number;
    activeUsers: number;
    totalHours: number;
    recordingSources: {
      bot: number;
      upload: number;
      browser: number;
    };
  };
  trends: {
    meetingsPerDay: Array<{ date: string; count: number }>;
    activeUsersPerDay: Array<{ date: string; count: number }>;
    costPerDay: Array<{ date: string; cost: number }>;
  };
  topUsers: Array<{
    userId: string;
    name: string;
    meetingCount: number;
    actionItemsCompleted: number;
  }>;
  apiUsage: {
    totalRequests: number;
    requestsPerDay: Array<{ date: string; count: number }>;
    topKeys: Array<{ keyPrefix: string; name: string; requests: number }>;
  };
  costs: {
    totalCost: number;
    breakdown: {
      transcription: number;
      summarization: number;
      storage: number;
    };
  };
}

class AnalyticsService {
  /**
   * Get user dashboard data
   */
  async getUserDashboard(
    userId: string,
    organizationId: string,
    days = 30
  ): Promise<UserDashboardData> {
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Get daily metrics
    const dailyMetrics = await prisma.userDailyMetrics.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get engagement data
    const engagement = await prisma.userEngagement.findUnique({
      where: { userId },
      include: {
        achievements: {
          include: { achievement: true },
          orderBy: { unlockedAt: 'desc' },
          take: 5,
        },
      },
    });

    // Calculate summary
    const totalMeetings = dailyMetrics.reduce((sum, d) => sum + d.meetingsRecorded, 0);
    const totalSeconds = dailyMetrics.reduce((sum, d) => sum + d.totalMeetingDuration, 0);
    const actionItemsCreated = dailyMetrics.reduce((sum, d) => sum + d.actionItemsCreated, 0);
    const actionItemsCompleted = dailyMetrics.reduce((sum, d) => sum + d.actionItemsCompleted, 0);

    // Find busiest day
    const dayTotals = dailyMetrics.reduce((acc, d) => {
      const day = format(d.date, 'EEEE');
      acc[day] = (acc[day] || 0) + d.meetingsRecorded;
      return acc;
    }, {} as Record<string, number>);
    const busiestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Calculate time saved (estimate: 30 min saved per meeting from notes/summary)
    const timeSavedHours = (totalMeetings * 30) / 60;

    return {
      summary: {
        totalMeetings,
        totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
        actionItemsCompleted,
        completionRate: actionItemsCreated > 0 
          ? Math.round((actionItemsCompleted / actionItemsCreated) * 100) 
          : 0,
        currentStreak: engagement?.currentStreak || 0,
      },
      trends: {
        meetingsPerDay: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          count: d.meetingsRecorded,
        })),
        productivityScore: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          score: this.calculateProductivityScore(d),
        })),
      },
      insights: {
        busiestDay,
        avgMeetingLength: totalMeetings > 0 
          ? Math.round(totalSeconds / totalMeetings / 60) 
          : 0,
        topCollaborators: [], // TODO: Implement from participant data
        timeSavedHours: Math.round(timeSavedHours * 10) / 10,
      },
      recentAchievements: engagement?.achievements.map(ua => ({
        code: ua.achievement.code,
        name: ua.achievement.name,
        icon: ua.achievement.icon,
        unlockedAt: ua.unlockedAt,
      })) || [],
    };
  }

  /**
   * Get organization dashboard data
   */
  async getOrgDashboard(
    organizationId: string,
    days = 30
  ): Promise<OrgDashboardData> {
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Get org daily metrics
    const dailyMetrics = await prisma.orgDailyMetrics.findMany({
      where: {
        organizationId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get top users
    const topUsers = await prisma.userDailyMetrics.groupBy({
      by: ['userId'],
      where: {
        organizationId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        meetingsRecorded: true,
        actionItemsCompleted: true,
      },
      orderBy: {
        _sum: { meetingsRecorded: 'desc' },
      },
      take: 10,
    });

    // Get user details for top users
    const userIds = topUsers.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Get API key usage
    const apiKeyUsage = await prisma.userApiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        usageCount: true,
      },
      orderBy: { usageCount: 'desc' },
      take: 5,
    });

    // Calculate totals
    const totalMeetings = dailyMetrics.reduce((sum, d) => sum + d.totalMeetings, 0);
    const totalMinutes = dailyMetrics.reduce((sum, d) => sum + d.totalMeetingMinutes, 0);
    const totalCost = dailyMetrics.reduce(
      (sum, d) => sum + d.transcriptionCost + d.summarizationCost + d.storageCost, 
      0
    );

    return {
      summary: {
        totalMeetings,
        activeUsers: new Set(dailyMetrics.flatMap(d => d.activeUsers)).size || 
          dailyMetrics[dailyMetrics.length - 1]?.activeUsers || 0,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        recordingSources: {
          bot: dailyMetrics.reduce((sum, d) => sum + d.meetingsFromBot, 0),
          upload: dailyMetrics.reduce((sum, d) => sum + d.meetingsFromUpload, 0),
          browser: dailyMetrics.reduce((sum, d) => sum + d.meetingsFromBrowser, 0),
        },
      },
      trends: {
        meetingsPerDay: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          count: d.totalMeetings,
        })),
        activeUsersPerDay: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          count: d.activeUsers,
        })),
        costPerDay: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          cost: (d.transcriptionCost + d.summarizationCost + d.storageCost) / 100,
        })),
      },
      topUsers: topUsers.map(u => ({
        userId: u.userId,
        name: userMap.get(u.userId)?.name || userMap.get(u.userId)?.email || 'Unknown',
        meetingCount: u._sum.meetingsRecorded || 0,
        actionItemsCompleted: u._sum.actionItemsCompleted || 0,
      })),
      apiUsage: {
        totalRequests: apiKeyUsage.reduce((sum, k) => sum + k.usageCount, 0),
        requestsPerDay: dailyMetrics.map(d => ({
          date: format(d.date, 'MMM dd'),
          count: d.apiKeyRequests,
        })),
        topKeys: apiKeyUsage.map(k => ({
          keyPrefix: k.keyPrefix,
          name: k.name,
          requests: k.usageCount,
        })),
      },
      costs: {
        totalCost: totalCost / 100, // Convert cents to dollars
        breakdown: {
          transcription: dailyMetrics.reduce((sum, d) => sum + d.transcriptionCost, 0) / 100,
          summarization: dailyMetrics.reduce((sum, d) => sum + d.summarizationCost, 0) / 100,
          storage: dailyMetrics.reduce((sum, d) => sum + d.storageCost, 0) / 100,
        },
      },
    };
  }

  /**
   * Calculate productivity score (0-100)
   */
  private calculateProductivityScore(metrics: {
    meetingsRecorded: number;
    actionItemsCreated: number;
    actionItemsCompleted: number;
    summariesViewed: number;
  }): number {
    let score = 0;
    
    // Meeting activity (up to 30 points)
    score += Math.min(metrics.meetingsRecorded * 10, 30);
    
    // Action item completion (up to 40 points)
    if (metrics.actionItemsCreated > 0) {
      score += (metrics.actionItemsCompleted / metrics.actionItemsCreated) * 40;
    }
    
    // Engagement with summaries (up to 30 points)
    score += Math.min(metrics.summariesViewed * 10, 30);
    
    return Math.round(score);
  }

  /**
   * Record daily metrics (called by cron job or after events)
   */
  async recordUserActivity(
    userId: string,
    organizationId: string,
    activity: Partial<{
      meetingsRecorded: number;
      meetingSource: 'bot' | 'upload' | 'browser';
      meetingDuration: number;
      speakingTime: number;
      actionItemsCreated: number;
      actionItemsCompleted: number;
      summaryViewed: boolean;
      transcriptViewed: boolean;
      searchPerformed: boolean;
    }>
  ): Promise<void> {
    const today = startOfDay(new Date());

    await prisma.userDailyMetrics.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      create: {
        userId,
        organizationId,
        date: today,
        meetingsRecorded: activity.meetingsRecorded || 0,
        meetingsFromBot: activity.meetingSource === 'bot' ? 1 : 0,
        meetingsFromUpload: activity.meetingSource === 'upload' ? 1 : 0,
        meetingsFromBrowser: activity.meetingSource === 'browser' ? 1 : 0,
        totalMeetingDuration: activity.meetingDuration || 0,
        totalSpeakingTime: activity.speakingTime || 0,
        actionItemsCreated: activity.actionItemsCreated || 0,
        actionItemsCompleted: activity.actionItemsCompleted || 0,
        summariesViewed: activity.summaryViewed ? 1 : 0,
        transcriptsViewed: activity.transcriptViewed ? 1 : 0,
        searchesPerformed: activity.searchPerformed ? 1 : 0,
      },
      update: {
        meetingsRecorded: { increment: activity.meetingsRecorded || 0 },
        meetingsFromBot: { increment: activity.meetingSource === 'bot' ? 1 : 0 },
        meetingsFromUpload: { increment: activity.meetingSource === 'upload' ? 1 : 0 },
        meetingsFromBrowser: { increment: activity.meetingSource === 'browser' ? 1 : 0 },
        totalMeetingDuration: { increment: activity.meetingDuration || 0 },
        totalSpeakingTime: { increment: activity.speakingTime || 0 },
        actionItemsCreated: { increment: activity.actionItemsCreated || 0 },
        actionItemsCompleted: { increment: activity.actionItemsCompleted || 0 },
        summariesViewed: { increment: activity.summaryViewed ? 1 : 0 },
        transcriptsViewed: { increment: activity.transcriptViewed ? 1 : 0 },
        searchesPerformed: { increment: activity.searchPerformed ? 1 : 0 },
      },
    });

    // Update engagement streak
    await this.updateStreak(userId, organizationId);
  }

  /**
   * Update user engagement streak
   */
  private async updateStreak(userId: string, organizationId: string): Promise<void> {
    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);

    const engagement = await prisma.userEngagement.findUnique({
      where: { userId },
    });

    if (!engagement) {
      // Create engagement record
      await prisma.userEngagement.create({
        data: {
          userId,
          organizationId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: today,
        },
      });
      return;
    }

    const lastActive = engagement.lastActiveDate 
      ? startOfDay(engagement.lastActiveDate) 
      : null;

    let newStreak = engagement.currentStreak;

    if (!lastActive || lastActive < yesterday) {
      // Streak broken or first activity
      newStreak = 1;
    } else if (lastActive.getTime() === yesterday.getTime()) {
      // Continuing streak
      newStreak = engagement.currentStreak + 1;
    }
    // If lastActive === today, streak stays the same

    await prisma.userEngagement.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(engagement.longestStreak, newStreak),
        lastActiveDate: today,
      },
    });

    // Check for streak achievements
    await this.checkStreakAchievements(userId, newStreak);
  }

  /**
   * Check and award streak achievements
   */
  private async checkStreakAchievements(userId: string, streak: number): Promise<void> {
    const streakMilestones = [
      { threshold: 7, code: 'streak_7' },
      { threshold: 30, code: 'streak_30' },
      { threshold: 100, code: 'streak_100' },
    ];

    for (const milestone of streakMilestones) {
      if (streak >= milestone.threshold) {
        await this.awardAchievement(userId, milestone.code);
      }
    }
  }

  /**
   * Award an achievement to a user
   */
  async awardAchievement(userId: string, achievementCode: string): Promise<boolean> {
    const achievement = await prisma.achievement.findUnique({
      where: { code: achievementCode },
    });

    if (!achievement) return false;

    try {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
        },
      });
      return true;
    } catch {
      // Already has achievement
      return false;
    }
  }
}

export const analyticsService = new AnalyticsService();
```

---

## SECTION C: Engagement & Retention Features

**8.6.3 Achievement Seeder**

Create packages/database/prisma/seeders/achievements.ts:

```typescript
import { PrismaClient } from '@prisma/client';

const achievements = [
  // Onboarding
  {
    code: 'first_meeting',
    name: 'First Meeting',
    description: 'Record your first meeting',
    icon: '🎉',
    category: 'onboarding',
    threshold: 1,
    points: 10,
  },
  {
    code: 'calendar_connected',
    name: 'Calendar Pro',
    description: 'Connect your calendar',
    icon: '📅',
    category: 'onboarding',
    threshold: 1,
    points: 10,
  },
  {
    code: 'first_upload',
    name: 'Uploader',
    description: 'Upload your first audio file',
    icon: '📤',
    category: 'onboarding',
    threshold: 1,
    points: 10,
  },
  {
    code: 'first_browser_recording',
    name: 'Live Recorder',
    description: 'Record an in-person meeting',
    icon: '🎙️',
    category: 'onboarding',
    threshold: 1,
    points: 15,
  },

  // Streaks
  {
    code: 'streak_7',
    name: 'Week Warrior',
    description: 'Use zigznote 7 days in a row',
    icon: '🔥',
    category: 'streak',
    threshold: 7,
    points: 25,
  },
  {
    code: 'streak_30',
    name: 'Monthly Master',
    description: 'Use zigznote 30 days in a row',
    icon: '💪',
    category: 'streak',
    threshold: 30,
    points: 100,
  },
  {
    code: 'streak_100',
    name: 'Centurion',
    description: 'Use zigznote 100 days in a row',
    icon: '🏆',
    category: 'streak',
    threshold: 100,
    points: 500,
  },

  // Milestones
  {
    code: 'meetings_10',
    name: 'Getting Started',
    description: 'Record 10 meetings',
    icon: '📊',
    category: 'milestone',
    threshold: 10,
    points: 20,
  },
  {
    code: 'meetings_50',
    name: 'Meeting Maven',
    description: 'Record 50 meetings',
    icon: '⭐',
    category: 'milestone',
    threshold: 50,
    points: 50,
  },
  {
    code: 'meetings_100',
    name: 'Meeting Master',
    description: 'Record 100 meetings',
    icon: '🌟',
    category: 'milestone',
    threshold: 100,
    points: 100,
  },
  {
    code: 'action_items_100',
    name: 'Action Hero',
    description: 'Complete 100 action items',
    icon: '✅',
    category: 'milestone',
    threshold: 100,
    points: 75,
  },

  // Power User
  {
    code: 'api_key_created',
    name: 'Developer',
    description: 'Create your first API key',
    icon: '🔑',
    category: 'power_user',
    threshold: 1,
    points: 20,
  },
  {
    code: 'webhook_created',
    name: 'Automator',
    description: 'Set up your first webhook',
    icon: '🔗',
    category: 'power_user',
    threshold: 1,
    points: 20,
  },
  {
    code: 'integration_connected',
    name: 'Connector',
    description: 'Connect an integration (Slack, HubSpot)',
    icon: '🔌',
    category: 'power_user',
    threshold: 1,
    points: 25,
  },
];

export async function seedAchievements(prisma: PrismaClient) {
  console.log('Seeding achievements...');

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: achievement,
      create: achievement,
    });
  }

  console.log(`Seeded ${achievements.length} achievements`);
}
```

Add to seed.ts:
```typescript
import { seedAchievements } from './seeders/achievements';

// In main():
await seedAchievements(prisma);
```

**8.6.4 Weekly Digest Job**

Create apps/api/src/jobs/weeklyDigestWorker.ts:

```typescript
/**
 * Weekly digest email job
 * Sends personalized weekly summary to users
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@zigznote/database';
import { analyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';
import { config } from '../config';
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns';

// Would integrate with email service (SendGrid, Resend, etc.)
interface DigestEmailData {
  userId: string;
  email: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    meetingsRecorded: number;
    actionItemsCompleted: number;
    hoursInMeetings: number;
    timeSavedMinutes: number;
    currentStreak: number;
  };
  highlights: string[];
  newAchievements: Array<{ name: string; icon: string }>;
}

export const weeklyDigestQueue = new Queue('weekly-digest', {
  connection: { host: config.redis.host, port: config.redis.port },
});

export const weeklyDigestWorker = new Worker(
  'weekly-digest',
  async (job: Job<{ scheduledRun?: boolean }>) => {
    logger.info('Starting weekly digest job');

    // Get all users with digest enabled
    const users = await prisma.userEngagement.findMany({
      where: {
        weeklyDigestEnabled: true,
        // Don't send if we sent in last 6 days
        OR: [
          { lastDigestSentAt: null },
          { lastDigestSentAt: { lt: subDays(new Date(), 6) } },
        ],
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, organizationId: true },
        },
      },
    });

    logger.info({ userCount: users.length }, 'Sending weekly digests');

    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());

    for (const engagement of users) {
      try {
        const dashboard = await analyticsService.getUserDashboard(
          engagement.userId,
          engagement.user.organizationId,
          7
        );

        // Get new achievements this week
        const newAchievements = await prisma.userAchievement.findMany({
          where: {
            userId: engagement.userId,
            unlockedAt: { gte: weekStart },
          },
          include: { achievement: true },
        });

        const digestData: DigestEmailData = {
          userId: engagement.userId,
          email: engagement.user.email,
          name: engagement.user.name || 'there',
          weekStart: format(weekStart, 'MMM d'),
          weekEnd: format(weekEnd, 'MMM d'),
          stats: {
            meetingsRecorded: dashboard.summary.totalMeetings,
            actionItemsCompleted: dashboard.summary.actionItemsCompleted,
            hoursInMeetings: dashboard.summary.totalHours,
            timeSavedMinutes: Math.round(dashboard.insights.timeSavedHours * 60),
            currentStreak: dashboard.summary.currentStreak,
          },
          highlights: generateHighlights(dashboard),
          newAchievements: newAchievements.map(ua => ({
            name: ua.achievement.name,
            icon: ua.achievement.icon,
          })),
        };

        // TODO: Send email via SendGrid/Resend
        // await emailService.sendWeeklyDigest(digestData);

        logger.info({ userId: engagement.userId }, 'Sent weekly digest');

        // Update last sent timestamp
        await prisma.userEngagement.update({
          where: { userId: engagement.userId },
          data: { lastDigestSentAt: new Date() },
        });

      } catch (error) {
        logger.error({ userId: engagement.userId, error }, 'Failed to send digest');
      }
    }

    return { processed: users.length };
  },
  { connection: { host: config.redis.host, port: config.redis.port } }
);

function generateHighlights(dashboard: any): string[] {
  const highlights: string[] = [];

  if (dashboard.summary.totalMeetings > 0) {
    highlights.push(`You recorded ${dashboard.summary.totalMeetings} meetings this week`);
  }

  if (dashboard.summary.completionRate >= 80) {
    highlights.push(`Great job! You completed ${dashboard.summary.completionRate}% of your action items`);
  }

  if (dashboard.summary.currentStreak >= 7) {
    highlights.push(`🔥 You're on a ${dashboard.summary.currentStreak}-day streak!`);
  }

  if (dashboard.insights.timeSavedHours > 0) {
    highlights.push(`You saved approximately ${Math.round(dashboard.insights.timeSavedHours)} hours on meeting notes`);
  }

  return highlights;
}

// Schedule weekly (Mondays at 9 AM)
export async function scheduleWeeklyDigest() {
  await weeklyDigestQueue.add(
    'send-digests',
    { scheduledRun: true },
    {
      repeat: {
        pattern: '0 9 * * 1', // Every Monday at 9 AM
      },
    }
  );
}
```

---

## SECTION D: Analytics API Routes

**8.6.5 Analytics Routes**

Create apps/api/src/routes/analytics.ts:

```typescript
/**
 * Analytics API routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analyticsService';
import { 
  requireAuth, 
  requireAdmin,
  asyncHandler, 
  validateRequest, 
  type AuthenticatedRequest 
} from '../middleware';

export const analyticsRouter: IRouter = Router();

analyticsRouter.use(requireAuth);

const dateRangeSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});

/**
 * GET /api/v1/analytics/dashboard
 * Get user's personal dashboard data
 */
analyticsRouter.get(
  '/dashboard',
  validateRequest(dateRangeSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const days = Number(req.query.days) || 30;

    const data = await analyticsService.getUserDashboard(
      authReq.auth!.userId,
      authReq.auth!.organizationId,
      days
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /api/v1/analytics/organization
 * Get organization dashboard data (admin only or all users based on settings)
 */
analyticsRouter.get(
  '/organization',
  validateRequest(dateRangeSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const days = Number(req.query.days) || 30;

    const data = await analyticsService.getOrgDashboard(
      authReq.auth!.organizationId,
      days
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /api/v1/analytics/achievements
 * Get user's achievements
 */
analyticsRouter.get(
  '/achievements',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;

    const [earned, available] = await Promise.all([
      prisma.userAchievement.findMany({
        where: { userId: authReq.auth!.userId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      prisma.achievement.findMany({
        orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
      }),
    ]);

    const earnedIds = new Set(earned.map(e => e.achievementId));

    res.json({
      success: true,
      data: {
        earned: earned.map(e => ({
          ...e.achievement,
          unlockedAt: e.unlockedAt,
        })),
        available: available.filter(a => !earnedIds.has(a.id)),
        totalPoints: earned.reduce((sum, e) => sum + e.achievement.points, 0),
      },
    });
  })
);

/**
 * GET /api/v1/analytics/engagement
 * Get user's engagement data (streak, etc.)
 */
analyticsRouter.get(
  '/engagement',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;

    let engagement = await prisma.userEngagement.findUnique({
      where: { userId: authReq.auth!.userId },
    });

    // Create if doesn't exist
    if (!engagement) {
      engagement = await prisma.userEngagement.create({
        data: {
          userId: authReq.auth!.userId,
          organizationId: authReq.auth!.organizationId,
        },
      });
    }

    res.json({ success: true, data: engagement });
  })
);

/**
 * PATCH /api/v1/analytics/engagement/digest
 * Update weekly digest preference
 */
analyticsRouter.patch(
  '/engagement/digest',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { enabled } = req.body;

    const engagement = await prisma.userEngagement.upsert({
      where: { userId: authReq.auth!.userId },
      update: { weeklyDigestEnabled: enabled },
      create: {
        userId: authReq.auth!.userId,
        organizationId: authReq.auth!.organizationId,
        weeklyDigestEnabled: enabled,
      },
    });

    res.json({ success: true, data: engagement });
  })
);

// Need prisma import
import { prisma } from '@zigznote/database';
```

Register in apps/api/src/routes/api.ts:
```typescript
import { analyticsRouter } from './analytics';

apiRouter.use('/v1/analytics', analyticsRouter);
```

---

## SECTION E: Frontend Dashboard Components

**8.6.6 Dashboard Overview Page Update**

Update apps/web/app/(dashboard)/page.tsx to show rich analytics:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const response = await api.get<UserDashboardData>('/api/v1/analytics/dashboard?days=30');
      return response.data;
    },
  });

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome & Streak */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Your meeting intelligence overview</p>
        </div>
        {data.summary.currentStreak > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full">
            <span className="text-xl">🔥</span>
            <span className="font-semibold">{data.summary.currentStreak} day streak</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Meetings"
          value={data.summary.totalMeetings}
          subtitle="This month"
          icon="📊"
        />
        <StatCard
          title="Hours in Meetings"
          value={data.summary.totalHours}
          subtitle="This month"
          icon="⏱️"
        />
        <StatCard
          title="Action Items Done"
          value={data.summary.actionItemsCompleted}
          subtitle={`${data.summary.completionRate}% completion rate`}
          icon="✅"
        />
        <StatCard
          title="Time Saved"
          value={`${data.insights.timeSavedHours}h`}
          subtitle="Estimated from auto-notes"
          icon="⚡"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meetings Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Activity</CardTitle>
            <CardDescription>Meetings recorded per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trends.meetingsPerDay}>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Productivity Score */}
        <Card>
          <CardHeader>
            <CardTitle>Productivity Score</CardTitle>
            <CardDescription>Based on meetings, action items, and engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends.productivityScore}>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Achievements Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Insights */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <InsightItem
                label="Busiest Day"
                value={data.insights.busiestDay}
                icon="📅"
              />
              <InsightItem
                label="Avg Meeting Length"
                value={`${data.insights.avgMeetingLength} min`}
                icon="⏰"
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Achievements */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAchievements.length > 0 ? (
              <div className="space-y-3">
                {data.recentAchievements.slice(0, 3).map((achievement) => (
                  <div 
                    key={achievement.code}
                    className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg"
                  >
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                Complete actions to unlock achievements!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon 
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <span className="text-3xl">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightItem({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: string; 
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

interface UserDashboardData {
  summary: {
    totalMeetings: number;
    totalHours: number;
    actionItemsCompleted: number;
    completionRate: number;
    currentStreak: number;
  };
  trends: {
    meetingsPerDay: Array<{ date: string; count: number }>;
    productivityScore: Array<{ date: string; score: number }>;
  };
  insights: {
    busiestDay: string;
    avgMeetingLength: number;
    timeSavedHours: number;
  };
  recentAchievements: Array<{
    code: string;
    name: string;
    icon: string;
    unlockedAt: string;
  }>;
}
```

**8.6.7 Organization Analytics Page**

Create apps/web/app/(dashboard)/analytics/page.tsx:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b'];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'organization'],
    queryFn: async () => {
      const response = await api.get('/api/v1/analytics/organization?days=30');
      return response.data as OrgDashboardData;
    },
  });

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  const sourceData = [
    { name: 'Meeting Bot', value: data.summary.recordingSources.bot },
    { name: 'File Upload', value: data.summary.recordingSources.upload },
    { name: 'Browser Recording', value: data.summary.recordingSources.browser },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Analytics</h1>
        <p className="text-slate-500">Organization-wide meeting intelligence</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Meetings</p>
            <p className="text-3xl font-bold">{data.summary.totalMeetings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Active Users</p>
            <p className="text-3xl font-bold">{data.summary.activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Hours</p>
            <p className="text-3xl font-bold">{data.summary.totalHours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Cost</p>
            <p className="text-3xl font-bold">${data.costs.totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="sources">Recording Sources</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="api">API Usage</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Meetings Per Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trends.meetingsPerDay}>
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Users Per Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trends.activeUsersPerDay}>
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#22c55e" 
                        strokeWidth={2} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recording Sources</CardTitle>
              <CardDescription>How meetings are being recorded</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sourceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Users</CardTitle>
              <CardDescription>Most active team members this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topUsers.map((user, index) => (
                  <div 
                    key={user.userId}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-slate-500">
                          {user.actionItemsCompleted} action items completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">{user.meetingCount}</p>
                      <p className="text-xs text-slate-500">meetings</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Requests</CardTitle>
                <CardDescription>
                  Total: {data.apiUsage.totalRequests.toLocaleString()} requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.apiUsage.requestsPerDay}>
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.apiUsage.topKeys.map((key) => (
                    <div 
                      key={key.keyPrefix}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{key.keyPrefix}••••</p>
                      </div>
                      <p className="font-bold">{key.requests.toLocaleString()}</p>
                    </div>
                  ))}
                  {data.apiUsage.topKeys.length === 0 && (
                    <p className="text-slate-500">No API keys created yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trends.costPerDay}>
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                      <Line 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <CostRow 
                    label="Transcription" 
                    value={data.costs.breakdown.transcription}
                    total={data.costs.totalCost}
                  />
                  <CostRow 
                    label="Summarization" 
                    value={data.costs.breakdown.summarization}
                    total={data.costs.totalCost}
                  />
                  <CostRow 
                    label="Storage" 
                    value={data.costs.breakdown.storage}
                    total={data.costs.totalCost}
                  />
                  <div className="pt-4 border-t">
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${data.costs.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CostRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>${value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface OrgDashboardData {
  summary: {
    totalMeetings: number;
    activeUsers: number;
    totalHours: number;
    recordingSources: {
      bot: number;
      upload: number;
      browser: number;
    };
  };
  trends: {
    meetingsPerDay: Array<{ date: string; count: number }>;
    activeUsersPerDay: Array<{ date: string; count: number }>;
    costPerDay: Array<{ date: string; cost: number }>;
  };
  topUsers: Array<{
    userId: string;
    name: string;
    meetingCount: number;
    actionItemsCompleted: number;
  }>;
  apiUsage: {
    totalRequests: number;
    requestsPerDay: Array<{ date: string; count: number }>;
    topKeys: Array<{ keyPrefix: string; name: string; requests: number }>;
  };
  costs: {
    totalCost: number;
    breakdown: {
      transcription: number;
      summarization: number;
      storage: number;
    };
  };
}
```

**8.6.8 Install Recharts**

```bash
cd apps/web
pnpm add recharts date-fns
pnpm add -D @types/recharts
```

**8.6.9 Add Analytics to Navigation**

Update sidebar to include Analytics link:
```tsx
{ name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
```

---

## SECTION F: Tracking Integration

**8.6.10 Track Activity on Key Events**

Update meeting creation to track metrics. Add to meeting service/controller after meeting is created:

```typescript
// After meeting creation
await analyticsService.recordUserActivity(userId, organizationId, {
  meetingsRecorded: 1,
  meetingSource: source as 'bot' | 'upload' | 'browser',
  meetingDuration: durationSeconds,
});
```

Add tracking when summary is viewed:
```typescript
// In getSummary endpoint
await analyticsService.recordUserActivity(userId, organizationId, {
  summaryViewed: true,
});
```

Add tracking when action item is completed:
```typescript
// In updateActionItem when marking complete
if (data.completed) {
  await analyticsService.recordUserActivity(userId, organizationId, {
    actionItemsCompleted: 1,
  });
}
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] `pnpm db:migrate` runs successfully
- [ ] Achievement seeding works
- [ ] User dashboard shows metrics and charts
- [ ] Organization dashboard shows team analytics
- [ ] Recording source breakdown displays correctly
- [ ] API key usage stats appear
- [ ] Streak tracking works
- [ ] Achievements unlock properly
- [ ] Charts render with Recharts
- [ ] **PHASES.md updated with Phase 8.6 section**
- [ ] PHASE_8_6_COMPLETE.md created

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add analytics dashboards and retention features

- User dashboard with meeting trends, productivity score, time saved
- Organization dashboard with team analytics and cost tracking
- Recording source breakdown (bot vs upload vs browser)
- API key usage statistics
- User engagement tracking with streaks
- Achievement/badge gamification system
- Weekly digest email job (SendGrid integration ready)
- Recharts for data visualization
- 14 achievements across 4 categories"
```

---

## Summary

After completing Phase 8.6:

| Feature | Status |
|---------|--------|
| User dashboard with trends | ✅ |
| Productivity scoring | ✅ |
| Time saved estimates | ✅ |
| Organization analytics | ✅ |
| Recording source breakdown | ✅ |
| API key usage stats | ✅ |
| Cost tracking | ✅ |
| Engagement streaks | ✅ |
| Achievement badges | ✅ |
| Weekly digest emails | ✅ |
| Recharts visualizations | ✅ |

This makes your dashboard **competitive with or better than** Circleback, Fireflies, and similar tools.

Ready for Phase 9: Mobile App (future).
