import { voiceProfileService } from '../../src/services/voiceProfileService';
import { prisma } from '@zigznote/database';

// Mock prisma
jest.mock('@zigznote/database', () => ({
  prisma: {
    voiceProfile: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    speakerMatch: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe('VoiceProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('should create a new voice profile', async () => {
      const input = {
        organizationId: 'org-1',
        displayName: 'John Doe',
        email: 'john@example.com',
        meetingId: 'meeting-1',
      };

      const expectedProfile = {
        id: 'profile-1',
        organizationId: 'org-1',
        displayName: 'John Doe',
        email: 'john@example.com',
        userId: null,
        voiceEmbedding: null,
        voiceHash: null,
        sampleCount: 1,
        totalDuration: 0,
        confidence: 0.5,
        firstMeetingId: 'meeting-1',
        lastMeetingId: 'meeting-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.voiceProfile.create as jest.Mock).mockResolvedValue(expectedProfile);

      const result = await voiceProfileService.createProfile(input);

      expect(result).toEqual(expectedProfile);
      expect(prisma.voiceProfile.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          displayName: 'John Doe',
          email: 'john@example.com',
          userId: undefined,
          firstMeetingId: 'meeting-1',
          lastMeetingId: 'meeting-1',
          voiceEmbedding: undefined,
          voiceHash: undefined,
          confidence: 0.5,
        },
      });
    });
  });

  describe('findOrCreateByName', () => {
    it('should return existing profile if found', async () => {
      const existingProfile = {
        id: 'profile-1',
        displayName: 'Sarah',
        organizationId: 'org-1',
        sampleCount: 3,
      };

      (prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue(existingProfile);
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue({
        ...existingProfile,
        lastMeetingId: 'meeting-1',
        sampleCount: 4,
      });

      const result = await voiceProfileService.findOrCreateByName(
        'org-1',
        'Sarah',
        'meeting-1'
      );

      expect(result.id).toBe('profile-1');
      expect(prisma.voiceProfile.create).not.toHaveBeenCalled();
      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: {
          lastMeetingId: 'meeting-1',
          sampleCount: { increment: 1 },
        },
      });
    });

    it('should create new profile if not found', async () => {
      const newProfile = {
        id: 'profile-2',
        displayName: 'John',
        organizationId: 'org-1',
        sampleCount: 1,
      };

      (prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.voiceProfile.create as jest.Mock).mockResolvedValue(newProfile);

      const result = await voiceProfileService.findOrCreateByName(
        'org-1',
        'John',
        'meeting-1'
      );

      expect(result.id).toBe('profile-2');
      expect(prisma.voiceProfile.create).toHaveBeenCalled();
    });

    it('should match case-insensitively', async () => {
      const existingProfile = {
        id: 'profile-1',
        displayName: 'Sarah',
        organizationId: 'org-1',
      };

      (prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue(existingProfile);
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue(existingProfile);

      await voiceProfileService.findOrCreateByName('org-1', 'SARAH', 'meeting-1');

      expect(prisma.voiceProfile.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          displayName: {
            equals: 'SARAH',
            mode: 'insensitive',
          },
        },
      });
    });
  });

  describe('recordMatch', () => {
    it('should upsert a speaker match', async () => {
      const input = {
        meetingId: 'meeting-1',
        speakerLabel: 'Speaker 0',
        voiceProfileId: 'profile-1',
        matchMethod: 'introduction' as const,
        confidence: 0.95,
        detectedPhrase: "Hi, I'm Sarah",
        detectedAt: 5.2,
      };

      const expectedMatch = {
        id: 'match-1',
        ...input,
        createdAt: new Date(),
      };

      (prisma.speakerMatch.upsert as jest.Mock).mockResolvedValue(expectedMatch);

      const result = await voiceProfileService.recordMatch(input);

      expect(result).toEqual(expectedMatch);
      expect(prisma.speakerMatch.upsert).toHaveBeenCalledWith({
        where: {
          meetingId_speakerLabel: {
            meetingId: 'meeting-1',
            speakerLabel: 'Speaker 0',
          },
        },
        create: input,
        update: {
          voiceProfileId: 'profile-1',
          matchMethod: 'introduction',
          confidence: 0.95,
          detectedPhrase: "Hi, I'm Sarah",
          detectedAt: 5.2,
        },
      });
    });
  });

  describe('getMeetingSpeakers', () => {
    it('should return list of identified speakers', async () => {
      const matches = [
        {
          speakerLabel: 'Speaker 0',
          voiceProfile: { displayName: 'Alice' },
          confidence: 0.9,
          matchMethod: 'introduction',
          voiceProfileId: 'profile-1',
        },
        {
          speakerLabel: 'Speaker 1',
          voiceProfile: { displayName: 'Bob' },
          confidence: 0.85,
          matchMethod: 'introduction',
          voiceProfileId: 'profile-2',
        },
      ];

      (prisma.speakerMatch.findMany as jest.Mock).mockResolvedValue(matches);

      const result = await voiceProfileService.getMeetingSpeakers('meeting-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        speakerLabel: 'Speaker 0',
        displayName: 'Alice',
        confidence: 0.9,
        matchMethod: 'introduction',
        voiceProfileId: 'profile-1',
      });
      expect(result[1]).toEqual({
        speakerLabel: 'Speaker 1',
        displayName: 'Bob',
        confidence: 0.85,
        matchMethod: 'introduction',
        voiceProfileId: 'profile-2',
      });
    });
  });

  describe('getSpeakerAliasMap', () => {
    it('should return map of speaker labels to names', async () => {
      const matches = [
        {
          speakerLabel: 'Speaker 0',
          voiceProfile: { displayName: 'Alice' },
          confidence: 0.9,
          matchMethod: 'introduction',
          voiceProfileId: 'profile-1',
        },
        {
          speakerLabel: 'Speaker 1',
          voiceProfile: { displayName: 'Bob' },
          confidence: 0.85,
          matchMethod: 'introduction',
          voiceProfileId: 'profile-2',
        },
      ];

      (prisma.speakerMatch.findMany as jest.Mock).mockResolvedValue(matches);

      const result = await voiceProfileService.getSpeakerAliasMap('meeting-1');

      expect(result.get('Speaker 0')).toBe('Alice');
      expect(result.get('Speaker 1')).toBe('Bob');
    });
  });

  describe('getOrgProfiles', () => {
    it('should return all profiles for organization', async () => {
      const profiles = [
        { id: 'profile-1', displayName: 'Alice', organizationId: 'org-1' },
        { id: 'profile-2', displayName: 'Bob', organizationId: 'org-1' },
      ];

      (prisma.voiceProfile.findMany as jest.Mock).mockResolvedValue(profiles);

      const result = await voiceProfileService.getOrgProfiles('org-1');

      expect(result).toEqual(profiles);
      expect(prisma.voiceProfile.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { displayName: 'asc' },
      });
    });
  });

  describe('confirmMatch', () => {
    it('should increment confidence when confirmed', async () => {
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue({});

      await voiceProfileService.confirmMatch('profile-1', true);

      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: {
          confidence: { increment: 0.1 },
        },
      });
    });

    it('should decrement confidence when rejected', async () => {
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue({});

      await voiceProfileService.confirmMatch('profile-1', false);

      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: {
          confidence: { increment: -0.1 },
        },
      });
    });
  });

  describe('mergeProfiles', () => {
    it('should merge two profiles correctly', async () => {
      const keepProfile = {
        id: 'profile-1',
        displayName: 'Sarah',
        sampleCount: 5,
        totalDuration: 1000,
        confidence: 0.8,
        email: 'sarah@example.com',
      };

      const mergeProfile = {
        id: 'profile-2',
        displayName: 'Sarah J',
        sampleCount: 3,
        totalDuration: 600,
        confidence: 0.9,
        email: null,
      };

      (prisma.voiceProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(keepProfile)
        .mockResolvedValueOnce(mergeProfile);
      (prisma.speakerMatch.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prisma.voiceProfile.update as jest.Mock).mockResolvedValue({
        ...keepProfile,
        sampleCount: 8,
        totalDuration: 1600,
        confidence: 0.9,
      });
      (prisma.voiceProfile.delete as jest.Mock).mockResolvedValue({});

      const result = await voiceProfileService.mergeProfiles('profile-1', 'profile-2');

      // Should move speaker matches
      expect(prisma.speakerMatch.updateMany).toHaveBeenCalledWith({
        where: { voiceProfileId: 'profile-2' },
        data: { voiceProfileId: 'profile-1' },
      });

      // Should update kept profile with combined data
      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: {
          sampleCount: 8,
          totalDuration: 1600,
          confidence: 0.9,
          email: 'sarah@example.com',
        },
      });

      // Should delete merged profile
      expect(prisma.voiceProfile.delete).toHaveBeenCalledWith({
        where: { id: 'profile-2' },
      });

      expect(result.sampleCount).toBe(8);
    });

    it('should throw error if keep profile not found', async () => {
      (prisma.voiceProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'profile-2' });

      await expect(
        voiceProfileService.mergeProfiles('profile-1', 'profile-2')
      ).rejects.toThrow('Profile not found');
    });

    it('should throw error if merge profile not found', async () => {
      (prisma.voiceProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'profile-1' })
        .mockResolvedValueOnce(null);

      await expect(
        voiceProfileService.mergeProfiles('profile-1', 'profile-2')
      ).rejects.toThrow('Profile not found');
    });
  });

  describe('matchFromCalendarParticipants', () => {
    it('should return profiles matching email addresses', async () => {
      const profiles = [
        { id: 'profile-1', displayName: 'Alice', email: 'alice@example.com' },
        { id: 'profile-2', displayName: 'Bob', email: 'bob@example.com' },
      ];

      (prisma.voiceProfile.findMany as jest.Mock).mockResolvedValue(profiles);

      const result = await voiceProfileService.matchFromCalendarParticipants(
        'org-1',
        ['alice@example.com', 'bob@example.com', 'charlie@example.com']
      );

      expect(result.size).toBe(2);
      expect(result.get('alice@example.com')?.displayName).toBe('Alice');
      expect(result.get('bob@example.com')?.displayName).toBe('Bob');
      expect(result.has('charlie@example.com')).toBe(false);
    });
  });

  describe('deleteProfile', () => {
    it('should delete a voice profile', async () => {
      (prisma.voiceProfile.delete as jest.Mock).mockResolvedValue({});

      await voiceProfileService.deleteProfile('profile-1');

      expect(prisma.voiceProfile.delete).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
      });
    });
  });

  describe('getSpeakerMatch', () => {
    it('should return speaker match for meeting and label', async () => {
      const match = {
        id: 'match-1',
        meetingId: 'meeting-1',
        speakerLabel: 'Speaker 0',
        voiceProfileId: 'profile-1',
      };

      (prisma.speakerMatch.findUnique as jest.Mock).mockResolvedValue(match);

      const result = await voiceProfileService.getSpeakerMatch('meeting-1', 'Speaker 0');

      expect(result).toEqual(match);
      expect(prisma.speakerMatch.findUnique).toHaveBeenCalledWith({
        where: {
          meetingId_speakerLabel: {
            meetingId: 'meeting-1',
            speakerLabel: 'Speaker 0',
          },
        },
      });
    });

    it('should return null if match not found', async () => {
      (prisma.speakerMatch.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await voiceProfileService.getSpeakerMatch('meeting-1', 'Speaker 99');

      expect(result).toBeNull();
    });
  });
});
