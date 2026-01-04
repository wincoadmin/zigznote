/**
 * Organization seeder
 */

import { PrismaClient, Organization } from '@prisma/client';
import { randomCompanyName, randomElement } from './utils';

const plans = ['free', 'starter', 'pro', 'enterprise'];

/**
 * Creates organizations for seeding
 */
export async function seedOrganizations(
  prisma: PrismaClient,
  count: number
): Promise<Organization[]> {
  console.info('Creating organizations...');

  const organizations: Organization[] = [];

  for (let o = 0; o < count; o++) {
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

  console.info(`  ✓ Created ${organizations.length} organizations`);
  return organizations;
}

/**
 * Creates organizations in batch for load testing
 */
export async function seedOrganizationsBatch(
  prisma: PrismaClient,
  count: number
): Promise<Organization[]> {
  const organizations: Organization[] = [];

  for (let o = 0; o < count; o++) {
    const org = await prisma.organization.create({
      data: {
        name: randomCompanyName(),
        plan: randomElement(plans),
      },
    });
    organizations.push(org);
  }

  return organizations;
}
