/**
 * Achievements seeder
 * Seeds the default achievements for gamification
 * Idempotent - safe to run multiple times
 */

import type { PrismaClient } from '@prisma/client';

interface AchievementData {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  points: number;
}

const DEFAULT_ACHIEVEMENTS: AchievementData[] = [
  // Onboarding achievements
  {
    code: 'onboarding_complete',
    name: 'Getting Started',
    description: 'Complete the onboarding flow',
    icon: '🎯',
    category: 'onboarding',
    threshold: 1,
    points: 10,
  },
  {
    code: 'first_meeting',
    name: 'First Meeting',
    description: 'Record your first meeting',
    icon: '🎬',
    category: 'onboarding',
    threshold: 1,
    points: 20,
  },
  {
    code: 'first_action_item',
    name: 'Taking Action',
    description: 'Complete your first action item',
    icon: '✅',
    category: 'onboarding',
    threshold: 1,
    points: 15,
  },

  // Meeting milestones
  {
    code: 'meeting_10',
    name: 'Meeting Pro',
    description: 'Record 10 meetings',
    icon: '📅',
    category: 'milestone',
    threshold: 10,
    points: 30,
  },
  {
    code: 'meeting_50',
    name: 'Meeting Expert',
    description: 'Record 50 meetings',
    icon: '🏆',
    category: 'milestone',
    threshold: 50,
    points: 50,
  },
  {
    code: 'meeting_100',
    name: 'Meeting Master',
    description: 'Record 100 meetings',
    icon: '👑',
    category: 'milestone',
    threshold: 100,
    points: 100,
  },

  // Streak achievements
  {
    code: 'streak_3',
    name: 'Consistent',
    description: 'Maintain a 3-day activity streak',
    icon: '🔥',
    category: 'streak',
    threshold: 3,
    points: 15,
  },
  {
    code: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day activity streak',
    icon: '⚡',
    category: 'streak',
    threshold: 7,
    points: 30,
  },
  {
    code: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day activity streak',
    icon: '💪',
    category: 'streak',
    threshold: 30,
    points: 75,
  },

  // Action item achievements
  {
    code: 'action_10',
    name: 'Productive',
    description: 'Complete 10 action items',
    icon: '📋',
    category: 'milestone',
    threshold: 10,
    points: 25,
  },
  {
    code: 'action_50',
    name: 'Getting Things Done',
    description: 'Complete 50 action items',
    icon: '🚀',
    category: 'milestone',
    threshold: 50,
    points: 60,
  },

  // Time saved achievements
  {
    code: 'time_saved_10',
    name: 'Time Saver',
    description: 'Save 10 hours with zigznote',
    icon: '⏰',
    category: 'power_user',
    threshold: 10,
    points: 40,
  },
  {
    code: 'time_saved_50',
    name: 'Efficiency Expert',
    description: 'Save 50 hours with zigznote',
    icon: '⌛',
    category: 'power_user',
    threshold: 50,
    points: 80,
  },

  // Power user achievements
  {
    code: 'power_user',
    name: 'Power User',
    description: 'Use search, integrations, and automations',
    icon: '⭐',
    category: 'power_user',
    threshold: 1,
    points: 50,
  },
];

/**
 * Seeds achievements
 * Uses upsert to avoid duplicates
 */
export async function seedAchievements(prisma: PrismaClient): Promise<number> {
  console.info('Seeding achievements...');

  let seeded = 0;

  for (const achievement of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: achievement,
    });
    seeded++;
  }

  console.info(`  ✓ Seeded ${seeded} achievements`);
  return seeded;
}

/**
 * Get all default achievements
 * Useful for testing
 */
export function getDefaultAchievements(): AchievementData[] {
  return DEFAULT_ACHIEVEMENTS;
}
