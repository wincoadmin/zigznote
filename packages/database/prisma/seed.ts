/**
 * Database seed script
 * Creates test data for development and testing
 * Supports multiple scales: minimal, development, load-test
 * Idempotent - safe to run multiple times
 *
 * @ownership
 * @domain Database Seeding
 * @description Orchestrates database seeding using modular seeders
 * @split-plan Seeders split into seeders/ directory
 * @last-reviewed 2026-01-04
 */

import { PrismaClient } from '@prisma/client';
import {
  seedOrganizations,
  seedUsers,
  seedMeetings,
  seedTranscriptsAndSummaries,
  seedActionItems,
  seedOrganizationsBatch,
  seedUsersBatch,
  seedMeetingsBatch,
  randomElement,
} from './seeders';

const prisma = new PrismaClient();

type SeedScale = 'minimal' | 'development' | 'load-test';

const SCALE_CONFIG = {
  minimal: { orgs: 1, usersPerOrg: 2, meetingsPerOrg: 5 },
  development: { orgs: 3, usersPerOrg: 5, meetingsPerOrg: 20 },
  'load-test': { orgs: 100, usersPerOrg: 20, meetingsPerOrg: 1000 },
};

/**
 * Clears all existing data from the database
 */
async function clearDatabase(): Promise<void> {
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
}

/**
 * Seed the database with the specified scale
 */
async function seed(scale: SeedScale = 'development') {
  const config = SCALE_CONFIG[scale];
  const startTime = Date.now();

  console.info(`\n🌱 Seeding database with ${scale} scale...`);
  console.info(`   - ${config.orgs} organizations`);
  console.info(`   - ${config.usersPerOrg} users per org`);
  console.info(`   - ${config.meetingsPerOrg} meetings per org`);
  console.info('');

  if (scale === 'minimal' || scale === 'development') {
    await seedDetailed(config);
  } else {
    await seedLoadTest(config);
  }

  const duration = Date.now() - startTime;
  console.info(`\n✅ Seeding completed in ${(duration / 1000).toFixed(2)}s`);
}

/**
 * Detailed seeding for minimal and development scales
 */
async function seedDetailed(config: { orgs: number; usersPerOrg: number; meetingsPerOrg: number }) {
  await clearDatabase();

  // Create organizations
  const organizations = await seedOrganizations(prisma, config.orgs);

  // Create users
  const users = await seedUsers(prisma, organizations, config.usersPerOrg);

  // Create meetings
  const meetings = await seedMeetings(prisma, organizations, users, config.meetingsPerOrg);

  // Create transcripts and summaries
  const transcriptCount = await seedTranscriptsAndSummaries(prisma, meetings, 50);

  // Create action items
  const actionItemCount = await seedActionItems(prisma, meetings, 30);

  // Create sample integration
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
    console.info('  ✓ Created sample integration');
  }

  // Summary
  console.info(`\n📊 Summary:`);
  console.info(`   Organizations: ${organizations.length}`);
  console.info(`   Users: ${users.length}`);
  console.info(`   Meetings: ${meetings.length}`);
  console.info(`   Transcripts: ${transcriptCount}`);
  console.info(`   Action Items: ${actionItemCount}`);
}

/**
 * Load test seeding - optimized for large datasets
 */
async function seedLoadTest(config: { orgs: number; usersPerOrg: number; meetingsPerOrg: number }) {
  await clearDatabase();

  let totalOrgs = 0;
  let totalUsers = 0;
  let totalMeetings = 0;

  const BATCH_SIZE = 10;

  for (let batch = 0; batch < config.orgs; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, config.orgs);

    for (let o = batch; o < batchEnd; o++) {
      const orgs = await seedOrganizationsBatch(prisma, 1);
      const org = orgs[0];
      totalOrgs++;

      const users = await seedUsersBatch(prisma, org.id, config.usersPerOrg);
      totalUsers += users.length;

      await seedMeetingsBatch(prisma, org.id, users, config.meetingsPerOrg);
      totalMeetings += config.meetingsPerOrg;
    }

    console.info(`   Progress: ${Math.min(batchEnd, config.orgs)}/${config.orgs} organizations`);
  }

  console.info(`\n📊 Summary:`);
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
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
