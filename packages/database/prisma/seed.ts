import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.info('Seeding database...');

  // Create a demo organization
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org-id' },
    update: {},
    create: {
      id: 'demo-org-id',
      name: 'Demo Organization',
      plan: 'pro',
      settings: {
        timezone: 'America/New_York',
        defaultLanguage: 'en',
      },
    },
  });

  console.info(`Created organization: ${org.name}`);

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@zigznote.com' },
    update: {},
    create: {
      email: 'demo@zigznote.com',
      name: 'Demo User',
      organizationId: org.id,
      role: 'admin',
    },
  });

  console.info(`Created user: ${user.email}`);

  // Create sample meetings
  const meetings = await Promise.all([
    prisma.meeting.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Product Sync',
        platform: 'zoom',
        status: 'completed',
        startTime: new Date('2024-01-15T14:00:00Z'),
        endTime: new Date('2024-01-15T15:00:00Z'),
        durationSeconds: 3600,
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Client Discovery Call',
        platform: 'meet',
        status: 'completed',
        startTime: new Date('2024-01-16T10:00:00Z'),
        endTime: new Date('2024-01-16T11:30:00Z'),
        durationSeconds: 5400,
      },
    }),
    prisma.meeting.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Weekly Standup',
        platform: 'teams',
        status: 'scheduled',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      },
    }),
  ]);

  console.info(`Created ${meetings.length} sample meetings`);

  // Create sample action items
  await prisma.actionItem.createMany({
    data: [
      {
        meetingId: meetings[0]!.id,
        text: 'Review Q1 roadmap draft',
        assignee: 'Demo User',
        dueDate: new Date('2024-01-20'),
        completed: true,
        completedAt: new Date('2024-01-18'),
      },
      {
        meetingId: meetings[0]!.id,
        text: 'Schedule follow-up with design team',
        assignee: 'Demo User',
        dueDate: new Date('2024-01-22'),
        completed: false,
      },
      {
        meetingId: meetings[1]!.id,
        text: 'Send proposal to client',
        assignee: 'Demo User',
        dueDate: new Date('2024-01-19'),
        completed: false,
      },
    ],
  });

  console.info('Created sample action items');

  console.info('Database seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
