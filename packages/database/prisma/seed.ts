/**
 * Database seed script
 * Creates test data for development and testing
 * Supports multiple scales: minimal, development, load-test
 * Idempotent - safe to run multiple times
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedScale = 'minimal' | 'development' | 'load-test';

const SCALE_CONFIG = {
  minimal: { orgs: 1, usersPerOrg: 2, meetingsPerOrg: 5 },
  development: { orgs: 3, usersPerOrg: 5, meetingsPerOrg: 20 },
  'load-test': { orgs: 100, usersPerOrg: 20, meetingsPerOrg: 1000 },
};

/**
 * Sample transcript segments for demo meetings
 */
const sampleSegments = [
  {
    speaker: 'Speaker 1',
    text: 'Good morning everyone, thanks for joining the product sync.',
    start_ms: 0,
    end_ms: 4000,
    confidence: 0.98,
  },
  {
    speaker: 'Speaker 2',
    text: "Thanks for having us. I wanted to discuss the Q1 roadmap updates.",
    start_ms: 4500,
    end_ms: 9000,
    confidence: 0.97,
  },
  {
    speaker: 'Speaker 1',
    text: "Great, let's start with the new features we're planning.",
    start_ms: 9500,
    end_ms: 13000,
    confidence: 0.99,
  },
  {
    speaker: 'Speaker 3',
    text: "I've prepared a list of the top requested features from customers.",
    start_ms: 13500,
    end_ms: 18000,
    confidence: 0.96,
  },
  {
    speaker: 'Speaker 2',
    text: 'The dashboard redesign is at the top of the list, followed by API improvements.',
    start_ms: 18500,
    end_ms: 24000,
    confidence: 0.98,
  },
];

/**
 * Sample summary content
 */
const sampleSummaryContent = {
  executive_summary:
    'The team discussed the Q1 roadmap updates, focusing on top customer-requested features including dashboard redesign and API improvements. Key decisions were made about prioritization.',
  topics: [
    {
      title: 'Q1 Roadmap',
      summary: 'Team reviewed planned features for Q1 release cycle.',
    },
    {
      title: 'Customer Feedback',
      summary:
        'Discussed top requested features including dashboard redesign.',
    },
    {
      title: 'API Improvements',
      summary: 'Agreed to prioritize API enhancements for developer experience.',
    },
  ],
  decisions: [
    'Dashboard redesign will be the primary focus for Q1',
    'API documentation will be updated alongside new features',
  ],
  questions: [
    'What is the timeline for the dashboard redesign?',
    'Who will lead the API improvements initiative?',
  ],
};

/**
 * Simple random generators (avoiding faker dependency for minimal setup)
 */
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomCompanyName(): string {
  const prefixes = ['Acme', 'Global', 'Tech', 'Digital', 'Cloud', 'Smart', 'Next', 'Future'];
  const suffixes = ['Corp', 'Inc', 'Solutions', 'Systems', 'Labs', 'Works', 'Hub', 'IO'];
  return `${randomElement(prefixes)} ${randomElement(suffixes)}`;
}

function randomPersonName(): string {
  const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

function randomMeetingTitle(): string {
  const types = ['Sync', 'Review', 'Planning', 'Standup', 'Retro', 'Demo', 'Workshop', 'Discussion'];
  const topics = ['Product', 'Engineering', 'Sales', 'Marketing', 'Design', 'Customer', 'Team', 'Project'];
  return `${randomElement(topics)} ${randomElement(types)}`;
}

/**
 * Seed the database with the specified scale
 */
async function seed(scale: SeedScale = 'development') {
  const config = SCALE_CONFIG[scale];
  const startTime = Date.now();

  console.info(`\n\uD83C\uDF31 Seeding database with ${scale} scale...`);
  console.info(`   - ${config.orgs} organizations`);
  console.info(`   - ${config.usersPerOrg} users per org`);
  console.info(`   - ${config.meetingsPerOrg} meetings per org`);
  console.info('');

  // For minimal and development, use the detailed seeding
  if (scale === 'minimal' || scale === 'development') {
    await seedDetailed(scale);
  } else {
    // For load-test, use batch seeding
    await seedLoadTest(config);
  }

  const duration = Date.now() - startTime;
  console.info(`\n\u2705 Seeding completed in ${(duration / 1000).toFixed(2)}s`);
}

/**
 * Detailed seeding for minimal and development scales
 * Creates realistic data with relationships
 */
async function seedDetailed(scale: SeedScale) {
  const config = SCALE_CONFIG[scale];

  // ==================== Clear existing data ====================
  console.info('Clearing existing data...');
  await prisma.actionItem.deleteMany();
  await prisma.summary.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.webhookLog.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.integrationConnection.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ==================== Organizations ====================
  console.info('Creating organizations...');

  const organizations = [];
  const plans = ['free', 'starter', 'pro', 'enterprise'];

  for (let o = 0; o < config.orgs; o++) {
    const org = await prisma.organization.create({
      data: {
        name: o === 0 ? 'Demo Organization' : randomCompanyName(),
        plan: o === 0 ? 'pro' : randomElement(plans),
        settings: {
          timezone: 'UTC',
          defaultLanguage: 'en',
          notificationsEnabled: true,
          autoJoinMeetings: true,
        },
      },
    });
    organizations.push(org);
  }
  console.info(`  \u2713 Created ${organizations.length} organizations`);

  // ==================== Users ====================
  console.info('Creating users...');

  const allUsers: Array<{ id: string; organizationId: string }> = [];
  const roles = ['admin', 'member'];

  for (const org of organizations) {
    for (let u = 0; u < config.usersPerOrg; u++) {
      const isFirst = u === 0;
      const user = await prisma.user.create({
        data: {
          clerkId: `clerk_${randomString(24)}`,
          email: isFirst && org === organizations[0]
            ? 'admin@zigznote.com'
            : `user${u}_${randomString(6)}@example.com`,
          name: isFirst && org === organizations[0]
            ? 'Admin User'
            : randomPersonName(),
          organizationId: org.id,
          role: isFirst ? 'admin' : randomElement(roles),
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomString(8)}`,
        },
      });
      allUsers.push({ id: user.id, organizationId: org.id });
    }
  }
  console.info(`  \u2713 Created ${allUsers.length} users`);

  // ==================== Meetings ====================
  console.info('Creating meetings...');

  const now = new Date();
  const statuses = ['scheduled', 'recording', 'processing', 'completed'];
  const platforms = ['zoom', 'meet', 'teams'];
  const meetings: Array<{ id: string; status: string; organizationId: string }> = [];

  for (const org of organizations) {
    const orgUsers = allUsers.filter((u) => u.organizationId === org.id);

    for (let m = 0; m < config.meetingsPerOrg; m++) {
      const status = m < config.meetingsPerOrg * 0.7
        ? 'completed'
        : randomElement(statuses);

      const startTime = new Date(
        now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000
      );
      const durationSeconds = Math.floor(Math.random() * 5400) + 900; // 15-90 min
      const endTime = status === 'completed'
        ? new Date(startTime.getTime() + durationSeconds * 1000)
        : null;

      const meeting = await prisma.meeting.create({
        data: {
          organizationId: org.id,
          createdById: randomElement(orgUsers).id,
          title: randomMeetingTitle(),
          platform: randomElement(platforms),
          meetingUrl: `https://${randomElement(platforms)}.example.com/${randomString(10)}`,
          status,
          startTime,
          endTime,
          durationSeconds: status === 'completed' ? durationSeconds : null,
        },
      });
      meetings.push({ id: meeting.id, status, organizationId: org.id });
    }
  }
  console.info(`  \u2713 Created ${meetings.length} meetings`);

  // ==================== Transcripts and Summaries ====================
  console.info('Creating transcripts and summaries...');

  const completedMeetings = meetings.filter((m) => m.status === 'completed');
  const fullText = sampleSegments.map((s) => s.text).join(' ');

  let transcriptCount = 0;
  for (const meeting of completedMeetings.slice(0, Math.min(50, completedMeetings.length))) {
    await prisma.transcript.create({
      data: {
        meetingId: meeting.id,
        segments: sampleSegments,
        fullText,
        wordCount: fullText.split(/\s+/).length,
        language: 'en',
      },
    });

    await prisma.summary.create({
      data: {
        meetingId: meeting.id,
        content: sampleSummaryContent,
        modelUsed: 'claude-3-5-sonnet-20241022',
        promptVersion: 'v1.0',
      },
    });
    transcriptCount++;
  }
  console.info(`  \u2713 Created ${transcriptCount} transcripts and summaries`);

  // ==================== Action Items ====================
  console.info('Creating action items...');

  let actionItemCount = 0;
  const actionTexts = [
    'Review document and provide feedback',
    'Schedule follow-up meeting',
    'Send proposal to client',
    'Update project documentation',
    'Complete code review',
    'Prepare presentation slides',
  ];

  for (const meeting of completedMeetings.slice(0, Math.min(30, completedMeetings.length))) {
    const numItems = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numItems; i++) {
      await prisma.actionItem.create({
        data: {
          meetingId: meeting.id,
          text: randomElement(actionTexts),
          assignee: randomPersonName(),
          dueDate: new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
          completed: Math.random() > 0.7,
        },
      });
      actionItemCount++;
    }
  }
  console.info(`  \u2713 Created ${actionItemCount} action items`);

  // ==================== Sample Integration ====================
  if (organizations[0]) {
    console.info('Creating sample integration...');
    await prisma.integrationConnection.create({
      data: {
        organizationId: organizations[0].id,
        provider: 'slack',
        credentials: { encrypted: true },
        settings: { defaultChannel: '#meetings', notifyOnComplete: true },
      },
    });
    console.info('  \u2713 Created sample integration');
  }

  // ==================== Summary ====================
  console.info(`\n\uD83D\uDCCA Summary:`);
  console.info(`   Organizations: ${organizations.length}`);
  console.info(`   Users: ${allUsers.length}`);
  console.info(`   Meetings: ${meetings.length}`);
  console.info(`   Transcripts: ${transcriptCount}`);
  console.info(`   Action Items: ${actionItemCount}`);
}

/**
 * Load test seeding - optimized for large datasets
 * Uses batch inserts for performance
 */
async function seedLoadTest(config: { orgs: number; usersPerOrg: number; meetingsPerOrg: number }) {
  console.info('Clearing existing data...');
  await prisma.actionItem.deleteMany();
  await prisma.summary.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.webhookLog.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.integrationConnection.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const plans = ['free', 'starter', 'pro', 'enterprise'];
  const roles = ['admin', 'member'];
  const statuses = ['scheduled', 'recording', 'processing', 'completed'];
  const platforms = ['zoom', 'meet', 'teams'];
  const now = new Date();

  let totalOrgs = 0;
  let totalUsers = 0;
  let totalMeetings = 0;

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 10;

  for (let batch = 0; batch < config.orgs; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, config.orgs);

    for (let o = batch; o < batchEnd; o++) {
      // Create organization
      const org = await prisma.organization.create({
        data: {
          name: randomCompanyName(),
          plan: randomElement(plans),
        },
      });
      totalOrgs++;

      // Create users for this org (batch)
      const usersData = [];
      for (let u = 0; u < config.usersPerOrg; u++) {
        usersData.push({
          clerkId: `clerk_${randomString(24)}`,
          email: `user${u}_${randomString(8)}@${randomString(6)}.com`,
          name: randomPersonName(),
          organizationId: org.id,
          role: u === 0 ? 'admin' : randomElement(roles),
        });
      }
      await prisma.user.createMany({ data: usersData });
      totalUsers += usersData.length;

      // Get user IDs for meetings
      const users = await prisma.user.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      });

      // Create meetings for this org (batch)
      const meetingsData = [];
      for (let m = 0; m < config.meetingsPerOrg; m++) {
        const status = m < config.meetingsPerOrg * 0.7 ? 'completed' : randomElement(statuses);
        const startTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        const durationSeconds = Math.floor(Math.random() * 5400) + 900;

        meetingsData.push({
          organizationId: org.id,
          createdById: randomElement(users).id,
          title: randomMeetingTitle(),
          platform: randomElement(platforms),
          status,
          startTime,
          endTime: status === 'completed' ? new Date(startTime.getTime() + durationSeconds * 1000) : null,
          durationSeconds: status === 'completed' ? durationSeconds : null,
        });
      }
      await prisma.meeting.createMany({ data: meetingsData });
      totalMeetings += meetingsData.length;
    }

    console.info(`   Progress: ${Math.min(batchEnd, config.orgs)}/${config.orgs} organizations`);
  }

  console.info(`\n\uD83D\uDCCA Summary:`);
  console.info(`   Organizations: ${totalOrgs}`);
  console.info(`   Users: ${totalUsers}`);
  console.info(`   Meetings: ${totalMeetings}`);
}

// Parse command line args
const scaleArg = process.argv.find((a) => a.startsWith('--scale='));
const scale = (scaleArg?.split('=')[1] || 'development') as SeedScale;

if (!SCALE_CONFIG[scale]) {
  console.error(`Invalid scale: ${scale}. Valid options: minimal, development, load-test`);
  process.exit(1);
}

seed(scale)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\u274C Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
