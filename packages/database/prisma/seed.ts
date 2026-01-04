/**
 * Database seed script
 * Creates test data for development and testing
 * Idempotent - safe to run multiple times
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main() {
  console.info('🌱 Seeding database...');

  // ==================== Organizations ====================
  console.info('Creating organizations...');

  const demoOrg = await prisma.organization.upsert({
    where: { id: 'demo-org-id' },
    update: {},
    create: {
      id: 'demo-org-id',
      name: 'Demo Organization',
      plan: 'pro',
      settings: {
        timezone: 'America/New_York',
        defaultLanguage: 'en',
        notificationsEnabled: true,
        autoJoinMeetings: true,
      },
    },
  });

  const testOrg = await prisma.organization.upsert({
    where: { id: 'test-org-id' },
    update: {},
    create: {
      id: 'test-org-id',
      name: 'Test Organization',
      plan: 'free',
      settings: {
        timezone: 'UTC',
        defaultLanguage: 'en',
      },
    },
  });

  console.info(`  ✓ Created ${[demoOrg, testOrg].length} organizations`);

  // ==================== Users ====================
  console.info('Creating users...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@zigznote.com' },
    update: {},
    create: {
      email: 'admin@zigznote.com',
      name: 'Admin User',
      organizationId: demoOrg.id,
      role: 'admin',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@zigznote.com' },
    update: {},
    create: {
      email: 'member@zigznote.com',
      name: 'Team Member',
      organizationId: demoOrg.id,
      role: 'member',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@zigznote.com' },
    update: {},
    create: {
      email: 'sales@zigznote.com',
      name: 'Sales Rep',
      organizationId: demoOrg.id,
      role: 'member',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sales',
    },
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'test@zigznote.com' },
    update: {},
    create: {
      email: 'test@zigznote.com',
      name: 'Test User',
      organizationId: testOrg.id,
      role: 'admin',
    },
  });

  console.info(
    `  ✓ Created ${[adminUser, memberUser, salesUser, testUser].length} users`
  );

  // ==================== Meetings ====================
  console.info('Creating meetings...');

  // Clean up existing meetings first (for idempotency)
  await prisma.meeting.deleteMany({
    where: { organizationId: { in: [demoOrg.id, testOrg.id] } },
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const meetings = await Promise.all([
    // Completed meetings with transcripts
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: adminUser.id,
        title: 'Product Sync - Q1 Planning',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/123456789',
        status: 'completed',
        startTime: lastWeek,
        endTime: new Date(lastWeek.getTime() + 60 * 60 * 1000),
        durationSeconds: 3600,
        metadata: { recordingAvailable: true },
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: salesUser.id,
        title: 'Client Discovery Call - Acme Corp',
        platform: 'meet',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        status: 'completed',
        startTime: yesterday,
        endTime: new Date(yesterday.getTime() + 45 * 60 * 1000),
        durationSeconds: 2700,
        metadata: { clientName: 'Acme Corp' },
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: memberUser.id,
        title: 'Design Review',
        platform: 'teams',
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/xyz',
        status: 'completed',
        startTime: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
        endTime: new Date(yesterday.getTime() + 5 * 60 * 60 * 1000),
        durationSeconds: 3600,
      },
    }),

    // Processing meeting
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: adminUser.id,
        title: 'Engineering Standup',
        platform: 'zoom',
        status: 'processing',
        startTime: new Date(now.getTime() - 30 * 60 * 1000),
        endTime: now,
        durationSeconds: 1800,
      },
    }),

    // Scheduled meetings
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: adminUser.id,
        title: 'Weekly Team Sync',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/987654321',
        status: 'scheduled',
        startTime: tomorrow,
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: salesUser.id,
        title: 'Sales Pipeline Review',
        platform: 'meet',
        status: 'scheduled',
        startTime: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: demoOrg.id,
        createdById: memberUser.id,
        title: 'Sprint Planning',
        platform: 'teams',
        status: 'scheduled',
        startTime: nextWeek,
      },
    }),

    // Test org meeting
    prisma.meeting.create({
      data: {
        organizationId: testOrg.id,
        createdById: testUser.id,
        title: 'Test Meeting',
        platform: 'zoom',
        status: 'completed',
        startTime: yesterday,
        endTime: new Date(yesterday.getTime() + 30 * 60 * 1000),
        durationSeconds: 1800,
      },
    }),
  ]);

  console.info(`  ✓ Created ${meetings.length} meetings`);

  // ==================== Participants ====================
  console.info('Creating meeting participants...');

  const completedMeetings = meetings.filter((m) => m.status === 'completed');

  for (const meeting of completedMeetings) {
    await prisma.meetingParticipant.createMany({
      data: [
        {
          meetingId: meeting.id,
          name: 'Host',
          email: 'host@example.com',
          speakerLabel: 'Speaker 1',
          isHost: true,
        },
        {
          meetingId: meeting.id,
          name: 'Participant 1',
          email: 'participant1@example.com',
          speakerLabel: 'Speaker 2',
          isHost: false,
        },
        {
          meetingId: meeting.id,
          name: 'Participant 2',
          email: 'participant2@example.com',
          speakerLabel: 'Speaker 3',
          isHost: false,
        },
      ],
    });
  }

  console.info(`  ✓ Created participants for ${completedMeetings.length} meetings`);

  // ==================== Transcripts and Summaries ====================
  console.info('Creating transcripts and summaries...');

  const fullText = sampleSegments.map((s) => s.text).join(' ');

  for (const meeting of completedMeetings.slice(0, 3)) {
    // Create transcript
    await prisma.transcript.upsert({
      where: { meetingId: meeting.id },
      update: {},
      create: {
        meetingId: meeting.id,
        segments: sampleSegments,
        fullText,
        wordCount: fullText.split(/\s+/).length,
        language: 'en',
      },
    });

    // Create summary
    await prisma.summary.upsert({
      where: { meetingId: meeting.id },
      update: {},
      create: {
        meetingId: meeting.id,
        content: sampleSummaryContent,
        modelUsed: 'claude-3-5-sonnet-20241022',
        promptVersion: 'v1.0',
      },
    });
  }

  console.info(`  ✓ Created transcripts and summaries`);

  // ==================== Action Items ====================
  console.info('Creating action items...');

  const actionItemsData = [
    {
      meetingId: meetings[0]!.id,
      text: 'Review Q1 roadmap draft',
      assignee: 'Admin User',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      completed: true,
      completedAt: yesterday,
    },
    {
      meetingId: meetings[0]!.id,
      text: 'Schedule follow-up with design team',
      assignee: 'Team Member',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      completed: false,
    },
    {
      meetingId: meetings[0]!.id,
      text: 'Update API documentation',
      assignee: 'Admin User',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      completed: false,
    },
    {
      meetingId: meetings[1]!.id,
      text: 'Send proposal to Acme Corp',
      assignee: 'Sales Rep',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      completed: false,
    },
    {
      meetingId: meetings[1]!.id,
      text: 'Schedule demo with technical team',
      assignee: 'Sales Rep',
      dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      completed: false,
    },
    {
      meetingId: meetings[2]!.id,
      text: 'Finalize design mockups',
      assignee: 'Team Member',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      completed: false,
    },
  ];

  // Clean up existing action items for these meetings
  await prisma.actionItem.deleteMany({
    where: { meetingId: { in: meetings.map((m) => m.id) } },
  });

  await prisma.actionItem.createMany({
    data: actionItemsData.map((item) => ({
      ...item,
      completedAt: item.completedAt ?? null,
    })),
  });

  console.info(`  ✓ Created ${actionItemsData.length} action items`);

  // ==================== Integrations ====================
  console.info('Creating sample integrations...');

  await prisma.integrationConnection.upsert({
    where: {
      organizationId_provider: {
        organizationId: demoOrg.id,
        provider: 'slack',
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      provider: 'slack',
      credentials: { encrypted: true },
      settings: {
        defaultChannel: '#meetings',
        notifyOnComplete: true,
      },
    },
  });

  console.info(`  ✓ Created sample integrations`);

  // ==================== Automation Rules ====================
  console.info('Creating sample automation rules...');

  await prisma.automationRule.upsert({
    where: { id: 'demo-automation-1' },
    update: {},
    create: {
      id: 'demo-automation-1',
      organizationId: demoOrg.id,
      name: 'Post summaries to Slack',
      trigger: 'meeting.completed',
      conditions: { platform: ['zoom', 'meet'] },
      actions: [
        {
          type: 'slack.send',
          config: { channel: '#meetings', includeActionItems: true },
        },
      ],
      enabled: true,
    },
  });

  console.info(`  ✓ Created sample automation rules`);

  // ==================== Summary ====================
  console.info('\n✅ Database seeding completed!');
  console.info('\n📊 Summary:');
  console.info(`   Organizations: 2`);
  console.info(`   Users: 4`);
  console.info(`   Meetings: ${meetings.length}`);
  console.info(`   Transcripts: 3`);
  console.info(`   Summaries: 3`);
  console.info(`   Action Items: ${actionItemsData.length}`);
  console.info(`   Integrations: 1`);
  console.info(`   Automation Rules: 1`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
