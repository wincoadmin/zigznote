/**
 * Tests for MeetingRepository
 * Uses mocked Prisma client for unit testing
 */

import { MeetingRepository } from '../../src/repositories/meetingRepository';
import { prisma } from '../../src/client';

// Mock the prisma client
jest.mock('../../src/client', () => ({
  prisma: {
    meeting: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    meetingParticipant: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('MeetingRepository', () => {
  let repository: MeetingRepository;

  beforeEach(() => {
    repository = new MeetingRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find meeting by ID', async () => {
      const mockMeeting = {
        id: 'meeting-1',
        title: 'Test Meeting',
        status: 'scheduled',
        organizationId: 'org-1',
      };

      (prisma.meeting.findFirst as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await repository.findById('meeting-1');

      expect(result).toEqual(mockMeeting);
      expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
        where: { id: 'meeting-1', deletedAt: null },
        include: undefined,
      });
    });

    it('should return null if not found', async () => {
      (prisma.meeting.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should include soft-deleted when requested', async () => {
      await repository.findById('meeting-1', undefined, true);

      expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        include: undefined,
      });
    });

    it('should include relations when requested', async () => {
      await repository.findById('meeting-1', { participants: true, transcript: true });

      expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
        where: { id: 'meeting-1', deletedAt: null },
        include: { participants: true, transcript: true },
      });
    });
  });

  describe('findByBotId', () => {
    it('should find meeting by bot ID', async () => {
      const mockMeeting = { id: 'meeting-1', botId: 'bot-123' };
      (prisma.meeting.findFirst as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await repository.findByBotId('bot-123');

      expect(result).toEqual(mockMeeting);
      expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
        where: { botId: 'bot-123', deletedAt: null },
        include: undefined,
      });
    });
  });

  describe('findManyPaginated', () => {
    it('should return paginated results', async () => {
      const mockMeetings = [
        { id: 'meeting-1', title: 'Meeting 1' },
        { id: 'meeting-2', title: 'Meeting 2' },
      ];

      (prisma.meeting.findMany as jest.Mock).mockResolvedValue(mockMeetings);
      (prisma.meeting.count as jest.Mock).mockResolvedValue(50);

      const result = await repository.findManyPaginated(
        { page: 1, limit: 20 },
        { organizationId: 'org-1' }
      );

      expect(result.data).toEqual(mockMeetings);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should filter by status', async () => {
      (prisma.meeting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.meeting.count as jest.Mock).mockResolvedValue(0);

      await repository.findManyPaginated(
        { page: 1, limit: 20 },
        { status: 'completed' }
      );

      expect(prisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    it('should filter by multiple statuses', async () => {
      (prisma.meeting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.meeting.count as jest.Mock).mockResolvedValue(0);

      await repository.findManyPaginated(
        { page: 1, limit: 20 },
        { status: ['scheduled', 'recording'] }
      );

      expect(prisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['scheduled', 'recording'] },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const startFrom = new Date('2024-01-01');
      const startTo = new Date('2024-01-31');

      (prisma.meeting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.meeting.count as jest.Mock).mockResolvedValue(0);

      await repository.findManyPaginated(
        { page: 1, limit: 20 },
        { startTimeFrom: startFrom, startTimeTo: startTo }
      );

      expect(prisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: startFrom, lte: startTo },
          }),
        })
      );
    });
  });

  describe('findUpcoming', () => {
    it('should return upcoming scheduled meetings', async () => {
      const mockMeetings = [{ id: 'meeting-1', status: 'scheduled' }];
      (prisma.meeting.findMany as jest.Mock).mockResolvedValue(mockMeetings);

      const result = await repository.findUpcoming('org-1', 10);

      expect(result).toEqual(mockMeetings);
      expect(prisma.meeting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            status: 'scheduled',
            deletedAt: null,
          }),
          orderBy: { startTime: 'asc' },
          take: 10,
        })
      );
    });
  });

  describe('create', () => {
    it('should create meeting with required fields', async () => {
      const mockMeeting = {
        id: 'new-meeting',
        title: 'New Meeting',
        organizationId: 'org-1',
        status: 'scheduled',
      };

      (prisma.meeting.create as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await repository.create({
        organizationId: 'org-1',
        title: 'New Meeting',
      });

      expect(result).toEqual(mockMeeting);
      expect(prisma.meeting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          title: 'New Meeting',
          status: 'scheduled',
        }),
        include: undefined,
      });
    });

    it('should create meeting with optional fields', async () => {
      const mockMeeting = {
        id: 'new-meeting',
        title: 'New Meeting',
        organizationId: 'org-1',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/123',
      };

      (prisma.meeting.create as jest.Mock).mockResolvedValue(mockMeeting);

      await repository.create({
        organizationId: 'org-1',
        title: 'New Meeting',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/123',
        startTime: new Date(),
      });

      expect(prisma.meeting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'zoom',
          meetingUrl: 'https://zoom.us/j/123',
        }),
        include: undefined,
      });
    });
  });

  describe('update', () => {
    it('should update meeting', async () => {
      const mockMeeting = {
        id: 'meeting-1',
        title: 'Updated Meeting',
        status: 'completed',
      };

      (prisma.meeting.update as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await repository.update('meeting-1', {
        title: 'Updated Meeting',
        status: 'completed',
      });

      expect(result).toEqual(mockMeeting);
      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        data: { title: 'Updated Meeting', status: 'completed' },
        include: undefined,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status to recording and set startTime', async () => {
      const mockMeeting = { id: 'meeting-1', status: 'recording' };
      (prisma.meeting.update as jest.Mock).mockResolvedValue(mockMeeting);

      await repository.updateStatus('meeting-1', 'recording');

      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        data: expect.objectContaining({
          status: 'recording',
          startTime: expect.any(Date),
        }),
      });
    });

    it('should update status to completed and calculate duration', async () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const mockMeeting = {
        id: 'meeting-1',
        status: 'completed',
        startTime,
      };

      (prisma.meeting.findFirst as jest.Mock).mockResolvedValue({
        id: 'meeting-1',
        startTime,
      });
      (prisma.meeting.update as jest.Mock).mockResolvedValue(mockMeeting);

      await repository.updateStatus('meeting-1', 'completed');

      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        data: expect.objectContaining({
          status: 'completed',
          endTime: expect.any(Date),
          durationSeconds: expect.any(Number),
        }),
      });
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt timestamp', async () => {
      await repository.softDelete('meeting-1');

      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete meeting', async () => {
      await repository.hardDelete('meeting-1');

      expect(prisma.meeting.delete).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
      });
    });
  });

  describe('restore', () => {
    it('should set deletedAt to null', async () => {
      const mockMeeting = { id: 'meeting-1', deletedAt: null };
      (prisma.meeting.update as jest.Mock).mockResolvedValue(mockMeeting);

      await repository.restore('meeting-1');

      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-1' },
        data: { deletedAt: null },
      });
    });
  });

  describe('addParticipants', () => {
    it('should add participants to meeting', async () => {
      const participants = [
        { name: 'John Doe', email: 'john@test.com', isHost: true },
        { name: 'Jane Doe', email: 'jane@test.com' },
      ];

      (prisma.meetingParticipant.createMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.meetingParticipant.findMany as jest.Mock).mockResolvedValue(participants);

      const result = await repository.addParticipants('meeting-1', participants);

      expect(result).toEqual(participants);
      expect(prisma.meetingParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { meetingId: 'meeting-1', name: 'John Doe', email: 'john@test.com', isHost: true, speakerLabel: undefined },
          { meetingId: 'meeting-1', name: 'Jane Doe', email: 'jane@test.com', isHost: false, speakerLabel: undefined },
        ],
      });
    });
  });

  describe('getStats', () => {
    it('should return meeting statistics', async () => {
      (prisma.meeting.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // thisWeek
        .mockResolvedValueOnce(50); // thisMonth

      (prisma.meeting.groupBy as jest.Mock).mockResolvedValue([
        { status: 'completed', _count: { status: 60 } },
        { status: 'scheduled', _count: { status: 40 } },
      ]);

      (prisma.meeting.aggregate as jest.Mock).mockResolvedValue({
        _sum: { durationSeconds: 360000 },
      });

      const stats = await repository.getStats('org-1');

      expect(stats.total).toBe(100);
      expect(stats.byStatus).toEqual({ completed: 60, scheduled: 40 });
      expect(stats.totalDuration).toBe(360000);
      expect(stats.thisWeek).toBe(20);
      expect(stats.thisMonth).toBe(50);
    });
  });
});
