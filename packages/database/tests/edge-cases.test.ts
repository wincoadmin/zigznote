/**
 * Database edge case tests
 * Tests for data integrity, transaction handling, and error scenarios
 */

import { prisma } from '../src/client';

describe('Database Edge Cases', () => {
  // Test organization for edge case tests
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test organization for these tests
    const org = await prisma.organization.create({
      data: { name: 'Edge Case Test Org' },
    });
    testOrgId = org.id;

    const user = await prisma.user.create({
      data: {
        clerkId: `edge_test_${Date.now()}`,
        email: `edge_test_${Date.now()}@example.com`,
        name: 'Edge Test User',
        organizationId: org.id,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.$disconnect();
  });

  describe('Connection Handling', () => {
    it('should handle multiple concurrent queries', async () => {
      // Simulate many concurrent queries
      const queries = Array(20)
        .fill(null)
        .map(() => prisma.organization.findMany({ take: 1 }));

      // All should complete without error
      const results = await Promise.all(queries);
      expect(results).toHaveLength(20);
      results.forEach((r) => expect(Array.isArray(r)).toBe(true));
    });

    it('should reconnect after disconnect', async () => {
      // Disconnect
      await prisma.$disconnect();

      // Next query should auto-reconnect
      const orgs = await prisma.organization.findMany({ take: 1 });
      expect(Array.isArray(orgs)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints on meeting creation', async () => {
      // Try to create meeting with non-existent org
      await expect(
        prisma.meeting.create({
          data: {
            organizationId: 'non-existent-org-id',
            createdById: 'non-existent-user-id',
            title: 'Test',
            platform: 'zoom',
            status: 'scheduled',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle unique constraint on user clerkId', async () => {
      const uniqueClerkId = `unique_clerk_${Date.now()}`;

      // Create first user
      const user1 = await prisma.user.create({
        data: {
          clerkId: uniqueClerkId,
          email: `unique1_${Date.now()}@example.com`,
          name: 'Test User 1',
          organizationId: testOrgId,
        },
      });

      // Try to create another user with same clerkId
      await expect(
        prisma.user.create({
          data: {
            clerkId: uniqueClerkId, // Duplicate
            email: `unique2_${Date.now()}@example.com`,
            name: 'Test User 2',
            organizationId: testOrgId,
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.user.delete({ where: { id: user1.id } });
    });

    it('should handle unique constraint on user email', async () => {
      const uniqueEmail = `unique_email_${Date.now()}@example.com`;

      // Create first user
      const user1 = await prisma.user.create({
        data: {
          clerkId: `clerk1_${Date.now()}`,
          email: uniqueEmail,
          name: 'Test User 1',
          organizationId: testOrgId,
        },
      });

      // Try to create another user with same email
      await expect(
        prisma.user.create({
          data: {
            clerkId: `clerk2_${Date.now()}`,
            email: uniqueEmail, // Duplicate
            name: 'Test User 2',
            organizationId: testOrgId,
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.user.delete({ where: { id: user1.id } });
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback transaction on error', async () => {
      const orgCountBefore = await prisma.organization.count();

      try {
        await prisma.$transaction(async (tx) => {
          await tx.organization.create({ data: { name: 'Will be rolled back' } });

          // Force an error
          throw new Error('Simulated transaction error');
        });
      } catch {
        // Expected to fail
      }

      const orgCountAfter = await prisma.organization.count();
      expect(orgCountAfter).toBe(orgCountBefore);
    });

    it('should handle concurrent updates correctly', async () => {
      // Create a test meeting
      const meeting = await prisma.meeting.create({
        data: {
          organizationId: testOrgId,
          createdById: testUserId,
          title: 'Concurrent Update Test',
          platform: 'zoom',
          status: 'scheduled',
        },
      });

      // Simulate concurrent updates
      const updates = Array(5)
        .fill(null)
        .map((_, i) =>
          prisma.meeting.update({
            where: { id: meeting.id },
            data: { title: `Update ${i}` },
          })
        );

      const results = await Promise.allSettled(updates);
      const succeeded = results.filter((r) => r.status === 'fulfilled');

      // All should succeed (last write wins)
      expect(succeeded.length).toBe(5);

      // Cleanup
      await prisma.meeting.delete({ where: { id: meeting.id } });
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large transcript text', async () => {
      const meeting = await prisma.meeting.create({
        data: {
          organizationId: testOrgId,
          createdById: testUserId,
          title: 'Large Transcript Test',
          platform: 'zoom',
          status: 'completed',
        },
      });

      // Create transcript with 50k characters (reasonable size)
      const largeText = 'word '.repeat(10000);

      const transcript = await prisma.transcript.create({
        data: {
          meetingId: meeting.id,
          fullText: largeText,
          segments: [],
          wordCount: 10000,
        },
      });

      expect(transcript.fullText.length).toBe(largeText.length);

      // Cleanup
      await prisma.transcript.delete({ where: { id: transcript.id } });
      await prisma.meeting.delete({ where: { id: meeting.id } });
    });

    it('should handle large JSON in segments', async () => {
      const meeting = await prisma.meeting.create({
        data: {
          organizationId: testOrgId,
          createdById: testUserId,
          title: 'Large Segments Test',
          platform: 'zoom',
          status: 'completed',
        },
      });

      // Create many segments
      const segments = Array(100)
        .fill(null)
        .map((_, i) => ({
          speaker: `Speaker ${i % 3}`,
          text: `This is segment ${i} with some content.`,
          start_ms: i * 5000,
          end_ms: (i + 1) * 5000,
          confidence: 0.95 + Math.random() * 0.05,
        }));

      const transcript = await prisma.transcript.create({
        data: {
          meetingId: meeting.id,
          fullText: segments.map((s) => s.text).join(' '),
          segments: segments,
          wordCount: segments.length * 7,
        },
      });

      expect(transcript.segments).toHaveLength(100);

      // Cleanup
      await prisma.transcript.delete({ where: { id: transcript.id } });
      await prisma.meeting.delete({ where: { id: meeting.id } });
    });
  });

  describe('Query Performance', () => {
    it('should fetch meetings list efficiently', async () => {
      const startTime = Date.now();

      await prisma.meeting.findMany({
        where: { status: 'completed' },
        orderBy: { startTime: 'desc' },
        take: 50,
      });

      const duration = Date.now() - startTime;
      // Should be fast with proper indexes
      expect(duration).toBeLessThan(500);
    });

    it('should filter meetings by organization efficiently', async () => {
      const startTime = Date.now();

      await prisma.meeting.findMany({
        where: { organizationId: testOrgId },
        take: 50,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Soft Delete Handling', () => {
    it('should soft delete a meeting', async () => {
      const meeting = await prisma.meeting.create({
        data: {
          organizationId: testOrgId,
          createdById: testUserId,
          title: 'Soft Delete Test',
          platform: 'zoom',
          status: 'completed',
        },
      });

      // Soft delete
      const deleted = await prisma.meeting.update({
        where: { id: meeting.id },
        data: { deletedAt: new Date() },
      });

      expect(deleted.deletedAt).not.toBeNull();

      // Can still find with explicit filter
      const found = await prisma.meeting.findUnique({
        where: { id: meeting.id },
      });
      expect(found).not.toBeNull();

      // Cleanup
      await prisma.meeting.delete({ where: { id: meeting.id } });
    });

    it('should restore a soft-deleted meeting', async () => {
      const meeting = await prisma.meeting.create({
        data: {
          organizationId: testOrgId,
          createdById: testUserId,
          title: 'Restore Test',
          platform: 'zoom',
          status: 'completed',
          deletedAt: new Date(),
        },
      });

      // Restore
      const restored = await prisma.meeting.update({
        where: { id: meeting.id },
        data: { deletedAt: null },
      });

      expect(restored.deletedAt).toBeNull();

      // Cleanup
      await prisma.meeting.delete({ where: { id: meeting.id } });
    });
  });
});
