/**
 * @file Meeting Service Unit Tests
 * @description Tests for meeting CRUD, access control, and related operations
 */

import { meetingService, MeetingService } from './meetingService';
import { meetingRepository, transcriptRepository, prisma, __resetMocks } from '@zigznote/database';

// Mock the database
jest.mock('@zigznote/database');

// Mock the recall service
jest.mock('./recallService', () => ({
  recallService: {
    createBot: jest.fn().mockResolvedValue({ id: 'bot-123' }),
  },
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the errors utility
jest.mock('../utils/errors', () => ({
  errors: {
    notFound: (entity: string) => {
      const error = new Error(`${entity} not found`);
      (error as Error & { statusCode: number }).statusCode = 404;
      return error;
    },
    forbidden: (message: string) => {
      const error = new Error(message);
      (error as Error & { statusCode: number }).statusCode = 403;
      return error;
    },
    badRequest: (message: string) => {
      const error = new Error(message);
      (error as Error & { statusCode: number }).statusCode = 400;
      return error;
    },
  },
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  })),
}));

// Mock the queue connection
jest.mock('../jobs/queues', () => ({
  getBullMQConnection: jest.fn().mockReturnValue({}),
}));

describe('MeetingService', () => {
  beforeEach(() => {
    __resetMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create meeting with valid data', async () => {
      const mockMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
        title: 'Test Meeting',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      (meetingRepository.create as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await meetingService.create({
        organizationId: 'org-123',
        title: 'Test Meeting',
      });

      expect(result.id).toBe('meeting-123');
      expect(result.title).toBe('Test Meeting');
      expect(meetingRepository.create).toHaveBeenCalledWith(
        { organizationId: 'org-123', title: 'Test Meeting' },
        { participants: true }
      );
    });

    it('should associate meeting with correct organization', async () => {
      const mockMeeting = {
        id: 'meeting-456',
        organizationId: 'org-specific',
        title: 'Org Meeting',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      (meetingRepository.create as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await meetingService.create({
        organizationId: 'org-specific',
        title: 'Org Meeting',
      });

      expect(result.id).toBe('meeting-456');
      expect(meetingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-specific' }),
        expect.anything()
      );
    });
  });

  describe('getById', () => {
    it('should return meeting for authorized user', async () => {
      const mockMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
        title: 'Test Meeting',
        status: 'scheduled',
        platform: 'zoom',
        meetingUrl: 'https://zoom.us/j/123',
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        transcript: null,
        summary: null,
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(mockMeeting);

      const result = await meetingService.getById('meeting-123', 'org-123');

      expect(result.id).toBe('meeting-123');
      expect(result.title).toBe('Test Meeting');
    });

    it('should deny access to meeting from different organization', async () => {
      const mockMeeting = {
        id: 'meeting-123',
        organizationId: 'org-other',
        title: 'Other Org Meeting',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(mockMeeting);

      await expect(meetingService.getById('meeting-123', 'org-123')).rejects.toThrow(
        'Access denied to this meeting'
      );
    });

    it('should throw not found for non-existent meeting', async () => {
      (meetingRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(meetingService.getById('meeting-nonexistent', 'org-123')).rejects.toThrow(
        'Meeting not found'
      );
    });
  });

  describe('update', () => {
    it('should update meeting with valid data', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
        title: 'Old Title',
      };
      const updatedMeeting = {
        ...existingMeeting,
        title: 'New Title',
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (meetingRepository.update as jest.Mock).mockResolvedValue(updatedMeeting);

      const result = await meetingService.update('meeting-123', 'org-123', {
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
      expect(meetingRepository.update).toHaveBeenCalledWith(
        'meeting-123',
        { title: 'New Title' },
        { participants: true }
      );
    });

    it('should reject update for meeting from different organization', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-other',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);

      await expect(
        meetingService.update('meeting-123', 'org-123', { title: 'New Title' })
      ).rejects.toThrow('Access denied to this meeting');
    });
  });

  describe('updateStatus', () => {
    it('should transition from scheduled to recording', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
        status: 'scheduled',
      };
      const updatedMeeting = {
        ...existingMeeting,
        status: 'recording',
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (meetingRepository.updateStatus as jest.Mock).mockResolvedValue(updatedMeeting);

      const result = await meetingService.updateStatus('meeting-123', 'org-123', 'recording');

      expect(result.status).toBe('recording');
    });

    it('should transition from recording to processing', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
        status: 'recording',
      };
      const updatedMeeting = {
        ...existingMeeting,
        status: 'processing',
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (meetingRepository.updateStatus as jest.Mock).mockResolvedValue(updatedMeeting);

      const result = await meetingService.updateStatus('meeting-123', 'org-123', 'processing');

      expect(result.status).toBe('processing');
    });
  });

  describe('delete', () => {
    it('should soft delete meeting', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (meetingRepository.softDelete as jest.Mock).mockResolvedValue(undefined);

      await meetingService.delete('meeting-123', 'org-123');

      expect(meetingRepository.softDelete).toHaveBeenCalledWith('meeting-123');
    });

    it('should throw not found for non-existent meeting', async () => {
      (meetingRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(meetingService.delete('meeting-nonexistent', 'org-123')).rejects.toThrow(
        'Meeting not found'
      );
    });

    it('should deny deletion for meeting from different organization', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-other',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);

      await expect(meetingService.delete('meeting-123', 'org-123')).rejects.toThrow(
        'Access denied to this meeting'
      );
    });
  });

  describe('getTranscript', () => {
    it('should return transcript for authorized meeting', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };
      const mockTranscript = {
        id: 'transcript-123',
        meetingId: 'meeting-123',
        content: 'Test transcript content',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (transcriptRepository.findByMeetingId as jest.Mock).mockResolvedValue(mockTranscript);

      const result = await meetingService.getTranscript('meeting-123', 'org-123');

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Test transcript content');
    });

    it('should deny access to transcript from different organization', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-other',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);

      await expect(meetingService.getTranscript('meeting-123', 'org-123')).rejects.toThrow(
        'Access denied to this meeting'
      );
    });
  });

  describe('getSummary', () => {
    it('should return summary for authorized meeting', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };
      const mockSummary = {
        id: 'summary-123',
        meetingId: 'meeting-123',
        content: 'Test summary content',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (transcriptRepository.findSummaryByMeetingId as jest.Mock).mockResolvedValue(mockSummary);

      const result = await meetingService.getSummary('meeting-123', 'org-123');

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Test summary content');
    });
  });

  describe('getActionItems', () => {
    it('should return action items for authorized meeting', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };
      const mockActionItems = [
        { id: 'action-1', text: 'Follow up on project', completed: false },
        { id: 'action-2', text: 'Send email', completed: true },
      ];

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (transcriptRepository.findActionItemsByMeetingId as jest.Mock).mockResolvedValue(mockActionItems);

      const result = await meetingService.getActionItems('meeting-123', 'org-123');

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Follow up on project');
    });
  });

  describe('regenerateSummary', () => {
    it('should queue regeneration job for valid meeting', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };
      const mockTranscript = {
        id: 'transcript-123',
        meetingId: 'meeting-123',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (transcriptRepository.findByMeetingId as jest.Mock).mockResolvedValue(mockTranscript);

      const result = await meetingService.regenerateSummary('meeting-123', 'org-123');

      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Summary regeneration has been queued');
    });

    it('should reject regeneration when no transcript exists', async () => {
      const existingMeeting = {
        id: 'meeting-123',
        organizationId: 'org-123',
      };

      (meetingRepository.findById as jest.Mock).mockResolvedValue(existingMeeting);
      (transcriptRepository.findByMeetingId as jest.Mock).mockResolvedValue(null);

      await expect(
        meetingService.regenerateSummary('meeting-123', 'org-123')
      ).rejects.toThrow('No transcript available for this meeting');
    });
  });

  describe('list', () => {
    it('should return paginated meetings', async () => {
      const mockMeetings = [
        {
          id: 'meeting-1',
          organizationId: 'org-123',
          title: 'Meeting 1',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [],
        },
        {
          id: 'meeting-2',
          organizationId: 'org-123',
          title: 'Meeting 2',
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [],
        },
      ];

      (meetingRepository.findManyPaginated as jest.Mock).mockResolvedValue({
        data: mockMeetings,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasMore: false,
        },
      });

      const result = await meetingService.list({
        organizationId: 'org-123',
        page: 1,
        limit: 20,
      });

      expect(result.meetings).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by status', async () => {
      (meetingRepository.findManyPaginated as jest.Mock).mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      });

      await meetingService.list({
        organizationId: 'org-123',
        page: 1,
        limit: 20,
        status: 'completed',
      });

      expect(meetingRepository.findManyPaginated).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        expect.objectContaining({ status: 'completed' }),
        expect.anything()
      );
    });
  });

  describe('getStats', () => {
    it('should return meeting statistics', async () => {
      const mockStats = {
        total: 50,
        byStatus: { completed: 30, scheduled: 15, recording: 5 },
        totalDuration: 36000,
        thisWeek: 5,
        thisMonth: 20,
      };

      (meetingRepository.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await meetingService.getStats('org-123');

      expect(result.total).toBe(50);
      expect(result.byStatus.completed).toBe(30);
      expect(result.thisMonth).toBe(20);
    });
  });
});
