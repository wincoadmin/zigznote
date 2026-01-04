/**
 * Meeting seeder
 */

import { PrismaClient, Organization } from '@prisma/client';
import {
  randomElement,
  randomString,
  randomMeetingTitle,
  randomPersonName,
  sampleSegments,
  sampleSummaryContent,
  actionTexts,
} from './utils';
import type { SeedUser } from './users';

const statuses = ['scheduled', 'recording', 'processing', 'completed'];
const platforms = ['zoom', 'meet', 'teams'];

export interface SeedMeeting {
  id: string;
  status: string;
  organizationId: string;
}

/**
 * Creates meetings for each organization
 */
export async function seedMeetings(
  prisma: PrismaClient,
  organizations: Organization[],
  allUsers: SeedUser[],
  meetingsPerOrg: number
): Promise<SeedMeeting[]> {
  console.info('Creating meetings...');

  const now = new Date();
  const meetings: SeedMeeting[] = [];

  for (const org of organizations) {
    const orgUsers = allUsers.filter((u) => u.organizationId === org.id);

    for (let m = 0; m < meetingsPerOrg; m++) {
      const status = m < meetingsPerOrg * 0.7 ? 'completed' : randomElement(statuses);

      const startTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const durationSeconds = Math.floor(Math.random() * 5400) + 900;
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

  console.info(`  ✓ Created ${meetings.length} meetings`);
  return meetings;
}

/**
 * Creates transcripts and summaries for completed meetings
 */
export async function seedTranscriptsAndSummaries(
  prisma: PrismaClient,
  meetings: SeedMeeting[],
  limit = 50
): Promise<number> {
  console.info('Creating transcripts and summaries...');

  const completedMeetings = meetings.filter((m) => m.status === 'completed');
  const fullText = sampleSegments.map((s) => s.text).join(' ');

  let count = 0;
  for (const meeting of completedMeetings.slice(0, Math.min(limit, completedMeetings.length))) {
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
    count++;
  }

  console.info(`  ✓ Created ${count} transcripts and summaries`);
  return count;
}

/**
 * Creates action items for completed meetings
 */
export async function seedActionItems(
  prisma: PrismaClient,
  meetings: SeedMeeting[],
  limit = 30
): Promise<number> {
  console.info('Creating action items...');

  const now = new Date();
  const completedMeetings = meetings.filter((m) => m.status === 'completed');

  let count = 0;
  for (const meeting of completedMeetings.slice(0, Math.min(limit, completedMeetings.length))) {
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
      count++;
    }
  }

  console.info(`  ✓ Created ${count} action items`);
  return count;
}

/**
 * Creates meetings in batch for load testing
 */
export async function seedMeetingsBatch(
  prisma: PrismaClient,
  organizationId: string,
  users: SeedUser[],
  count: number
): Promise<void> {
  const now = new Date();
  const meetingsData = [];

  for (let m = 0; m < count; m++) {
    const status = m < count * 0.7 ? 'completed' : randomElement(statuses);
    const startTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const durationSeconds = Math.floor(Math.random() * 5400) + 900;

    meetingsData.push({
      organizationId,
      createdById: randomElement(users).id,
      title: randomMeetingTitle(),
      platform: randomElement(platforms),
      status,
      startTime,
      endTime: status === 'completed'
        ? new Date(startTime.getTime() + durationSeconds * 1000)
        : null,
      durationSeconds: status === 'completed' ? durationSeconds : null,
    });
  }

  await prisma.meeting.createMany({ data: meetingsData });
}
