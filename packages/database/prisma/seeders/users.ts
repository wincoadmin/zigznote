/**
 * User seeder
 */

import { PrismaClient, Organization } from '@prisma/client';
import { randomString, randomPersonName, randomElement } from './utils';

const roles = ['admin', 'member'];

export interface SeedUser {
  id: string;
  organizationId: string;
}

/**
 * Creates users for each organization
 */
export async function seedUsers(
  prisma: PrismaClient,
  organizations: Organization[],
  usersPerOrg: number
): Promise<SeedUser[]> {
  console.info('Creating users...');

  const allUsers: SeedUser[] = [];

  for (const org of organizations) {
    for (let u = 0; u < usersPerOrg; u++) {
      const isFirst = u === 0;
      const isDemo = org === organizations[0];

      const user = await prisma.user.create({
        data: {
          clerkId: `clerk_${randomString(24)}`,
          email: isFirst && isDemo ? 'admin@zigznote.com' : `user${u}_${randomString(6)}@example.com`,
          name: isFirst && isDemo ? 'Admin User' : randomPersonName(),
          organizationId: org.id,
          role: isFirst ? 'admin' : randomElement(roles),
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomString(8)}`,
        },
      });
      allUsers.push({ id: user.id, organizationId: org.id });
    }
  }

  console.info(`  ✓ Created ${allUsers.length} users`);
  return allUsers;
}

/**
 * Creates users in batch for load testing
 */
export async function seedUsersBatch(
  prisma: PrismaClient,
  organizationId: string,
  count: number
): Promise<SeedUser[]> {
  const usersData = [];

  for (let u = 0; u < count; u++) {
    usersData.push({
      clerkId: `clerk_${randomString(24)}`,
      email: `user${u}_${randomString(8)}@${randomString(6)}.com`,
      name: randomPersonName(),
      organizationId,
      role: u === 0 ? 'admin' : randomElement(roles),
    });
  }

  await prisma.user.createMany({ data: usersData });

  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });

  return users.map((u) => ({ id: u.id, organizationId }));
}
