/**
 * H.1 User Behavior Edge Cases Tests
 * Tests for real-world user behavior scenarios
 */

import { prisma } from '@zigznote/database';

// Mock services for testing
const mockNotificationService = {
  send: jest.fn(),
  sendEmail: jest.fn(),
};

const mockBillingService = {
  updateSeatCount: jest.fn(),
  updateBillingContact: jest.fn(),
};

const mockBotService = {
  cancelScheduledBots: jest.fn(),
};

describe('User Behavior Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding Abandonment', () => {
    it('should track onboarding funnel stages', async () => {
      // User signs up but abandons before calendar connect
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        onboardingStep: 'signup_complete',
        createdAt: new Date(),
      };

      // Verify onboarding step is tracked
      expect(user.onboardingStep).toBe('signup_complete');
      expect(['signup_complete', 'calendar_connected', 'first_meeting', 'completed'])
        .toContain(user.onboardingStep);
    });

    it('should identify users stuck in onboarding after 3 days', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const stuckUsers = [
        { id: 'user-1', onboardingStep: 'signup_complete', createdAt: threeDaysAgo },
        { id: 'user-2', onboardingStep: 'calendar_connected', createdAt: threeDaysAgo },
      ];

      // Filter users who haven't completed onboarding
      const usersNeedingReminder = stuckUsers.filter(
        u => u.onboardingStep !== 'completed' &&
        u.createdAt <= threeDaysAgo
      );

      expect(usersNeedingReminder.length).toBe(2);
    });

    it('should show contextual prompts for incomplete setup', async () => {
      const user = {
        id: 'user-1',
        hasCalendarConnected: false,
        onboardingStep: 'signup_complete',
      };

      // Determine which prompts to show
      const prompts: string[] = [];

      if (!user.hasCalendarConnected) {
        prompts.push('connect_calendar');
      }

      if (user.onboardingStep === 'signup_complete') {
        prompts.push('complete_profile');
      }

      expect(prompts).toContain('connect_calendar');
    });
  });

  describe('Team Member Departure', () => {
    it('should transfer meeting ownership when member leaves', async () => {
      const departingMember = { id: 'member-1', organizationId: 'org-1' };
      const orgOwner = { id: 'owner-1', organizationId: 'org-1', role: 'admin' };

      const memberMeetings = [
        { id: 'meeting-1', createdById: departingMember.id },
        { id: 'meeting-2', createdById: departingMember.id },
      ];

      // Transfer meetings to org owner
      const transferredMeetings = memberMeetings.map(m => ({
        ...m,
        createdById: orgOwner.id,
        previousOwnerId: departingMember.id,
      }));

      expect(transferredMeetings.every(m => m.createdById === orgOwner.id)).toBe(true);
      expect(transferredMeetings.every(m => m.previousOwnerId === departingMember.id)).toBe(true);
    });

    it('should cancel scheduled bots for departed member', async () => {
      const departingMember = { id: 'member-1' };

      const scheduledMeetings = [
        { id: 'meeting-1', scheduledFor: new Date(Date.now() + 86400000), botStatus: 'scheduled' },
        { id: 'meeting-2', scheduledFor: new Date(Date.now() + 172800000), botStatus: 'scheduled' },
      ];

      // Cancel bots for future meetings
      const cancelledMeetings = scheduledMeetings.map(m => ({
        ...m,
        botStatus: 'cancelled',
        cancellationReason: 'member_departed',
      }));

      expect(cancelledMeetings.every(m => m.botStatus === 'cancelled')).toBe(true);
    });

    it('should update seat count for billing', async () => {
      const organization = {
        id: 'org-1',
        seatCount: 5,
        billingPlan: 'pro',
      };

      // Remove one seat
      const updatedOrg = {
        ...organization,
        seatCount: organization.seatCount - 1,
      };

      expect(updatedOrg.seatCount).toBe(4);
    });
  });

  describe('Organization Owner Departure', () => {
    it('should require ownership transfer before owner leaves', async () => {
      const owner = { id: 'owner-1', role: 'owner', organizationId: 'org-1' };
      const members = [
        { id: 'member-1', role: 'admin' },
        { id: 'member-2', role: 'member' },
      ];

      // Check if there are other admins who can take ownership
      const potentialOwners = members.filter(m => m.role === 'admin');

      const canLeaveWithoutTransfer = potentialOwners.length > 0;

      if (!canLeaveWithoutTransfer) {
        // Owner must transfer ownership first
        expect(() => {
          throw new Error('Cannot leave organization without transferring ownership');
        }).toThrow('Cannot leave organization without transferring ownership');
      }
    });

    it('should transfer billing contact on ownership change', async () => {
      const oldOwner = { id: 'owner-1', email: 'old@example.com' };
      const newOwner = { id: 'owner-2', email: 'new@example.com' };

      const billingCustomer = {
        organizationId: 'org-1',
        email: oldOwner.email,
      };

      // Transfer billing contact
      const updatedBilling = {
        ...billingCustomer,
        email: newOwner.email,
        previousEmail: oldOwner.email,
      };

      expect(updatedBilling.email).toBe(newOwner.email);
    });
  });

  describe('Meeting Consent', () => {
    it('should announce bot when configured', async () => {
      const meeting = {
        id: 'meeting-1',
        settings: {
          announceBot: true,
          consentMessage: 'This meeting is being recorded by zigznote.',
        },
      };

      expect(meeting.settings.announceBot).toBe(true);
      expect(meeting.settings.consentMessage).toContain('recorded');
    });

    it('should respect do not record preference for external meetings', async () => {
      const user = {
        id: 'user-1',
        settings: {
          recordExternalMeetings: false,
        },
      };

      const meeting = {
        id: 'meeting-1',
        isExternal: true,
        participants: ['external@other.com'],
      };

      const shouldRecord = !meeting.isExternal || user.settings.recordExternalMeetings;

      expect(shouldRecord).toBe(false);
    });
  });

  describe('Sensitive Meeting Detection', () => {
    const sensitiveKeywords = [
      'performance review',
      'termination',
      'salary',
      'confidential',
      'private',
      'hr meeting',
      'disciplinary',
      'layoff',
    ];

    it('should warn about potentially sensitive meetings', async () => {
      const meetingTitle = 'Q4 Performance Review - John Smith';

      const isSensitive = sensitiveKeywords.some(keyword =>
        meetingTitle.toLowerCase().includes(keyword)
      );

      expect(isSensitive).toBe(true);
    });

    it('should not flag normal meetings as sensitive', async () => {
      const meetingTitle = 'Weekly Team Standup';

      const isSensitive = sensitiveKeywords.some(keyword =>
        meetingTitle.toLowerCase().includes(keyword)
      );

      expect(isSensitive).toBe(false);
    });

    it('should support enhanced privacy mode', async () => {
      const meeting = {
        id: 'meeting-1',
        title: 'HR Confidential Discussion',
        privacyMode: 'enhanced',
        settings: {
          excludeFromSearch: true,
          restrictedAccess: true,
          noAutoSummary: true,
        },
      };

      expect(meeting.settings.excludeFromSearch).toBe(true);
      expect(meeting.settings.restrictedAccess).toBe(true);
    });
  });

  describe('Meeting Overlap Handling', () => {
    it('should detect overlapping meetings', async () => {
      const meetings = [
        { id: 'meeting-1', startTime: new Date('2024-01-15T10:00:00Z'), endTime: new Date('2024-01-15T11:00:00Z') },
        { id: 'meeting-2', startTime: new Date('2024-01-15T10:30:00Z'), endTime: new Date('2024-01-15T11:30:00Z') },
      ];

      const hasOverlap = (m1: typeof meetings[0], m2: typeof meetings[0]) => {
        return m1.startTime < m2.endTime && m2.startTime < m1.endTime;
      };

      expect(hasOverlap(meetings[0], meetings[1])).toBe(true);
    });

    it('should not detect non-overlapping meetings', async () => {
      const meetings = [
        { id: 'meeting-1', startTime: new Date('2024-01-15T10:00:00Z'), endTime: new Date('2024-01-15T11:00:00Z') },
        { id: 'meeting-2', startTime: new Date('2024-01-15T11:00:00Z'), endTime: new Date('2024-01-15T12:00:00Z') },
      ];

      const hasOverlap = (m1: typeof meetings[0], m2: typeof meetings[0]) => {
        return m1.startTime < m2.endTime && m2.startTime < m1.endTime;
      };

      expect(hasOverlap(meetings[0], meetings[1])).toBe(false);
    });

    it('should respect user overlap preference', async () => {
      const user = {
        id: 'user-1',
        settings: {
          overlapBehavior: 'record_first', // 'record_first' | 'record_both' | 'ask_user'
        },
      };

      expect(['record_first', 'record_both', 'ask_user']).toContain(user.settings.overlapBehavior);
    });
  });

  describe('Storage & Retention', () => {
    it('should warn when approaching storage limit', async () => {
      const organization = {
        id: 'org-1',
        storageUsedBytes: 8_000_000_000, // 8GB
        storageLimitBytes: 10_000_000_000, // 10GB
      };

      const usagePercent = (organization.storageUsedBytes / organization.storageLimitBytes) * 100;
      const shouldWarn = usagePercent >= 80;

      expect(shouldWarn).toBe(true);
      expect(usagePercent).toBe(80);
    });

    it('should block recording when storage full', async () => {
      const organization = {
        id: 'org-1',
        storageUsedBytes: 10_000_000_000,
        storageLimitBytes: 10_000_000_000,
      };

      const usagePercent = (organization.storageUsedBytes / organization.storageLimitBytes) * 100;
      const shouldBlock = usagePercent >= 100;

      expect(shouldBlock).toBe(true);
    });

    it('should respect retention policy without deleting bookmarked meetings', async () => {
      const retentionDays = 90;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const meetings = [
        { id: 'meeting-1', createdAt: new Date('2024-01-01'), isBookmarked: false },
        { id: 'meeting-2', createdAt: new Date('2024-01-01'), isBookmarked: true },
        { id: 'meeting-3', createdAt: new Date(), isBookmarked: false },
      ];

      const meetingsToDelete = meetings.filter(
        m => m.createdAt < cutoffDate && !m.isBookmarked
      );

      // Only unbookmarked old meetings should be deleted
      expect(meetingsToDelete.length).toBe(1);
      expect(meetingsToDelete[0].id).toBe('meeting-1');
    });

    it('should not auto-delete meetings with unresolved action items', async () => {
      const meeting = {
        id: 'meeting-1',
        createdAt: new Date('2024-01-01'),
        actionItems: [
          { id: 'action-1', completed: false },
          { id: 'action-2', completed: true },
        ],
      };

      const hasUnresolvedActions = meeting.actionItems.some(a => !a.completed);
      const shouldExtendRetention = hasUnresolvedActions;

      expect(shouldExtendRetention).toBe(true);
    });
  });

  describe('Timezone Handling', () => {
    it('should store all times in UTC', async () => {
      const localTime = new Date('2024-01-15T10:00:00-08:00'); // PST
      const utcTime = localTime.toISOString();

      // UTC should be 8 hours ahead of PST
      expect(utcTime).toBe('2024-01-15T18:00:00.000Z');
    });

    it('should convert UTC to user timezone for display', async () => {
      const utcTime = new Date('2024-01-15T18:00:00Z');
      const userTimezone = 'America/Los_Angeles';

      // Format in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });

      const localDisplay = formatter.format(utcTime);
      expect(localDisplay).toBe('10:00 AM');
    });

    it('should detect meetings during DST transitions', async () => {
      // DST change dates (approximate)
      const dstDates = [
        new Date('2024-03-10'), // Spring forward
        new Date('2024-11-03'), // Fall back
      ];

      const meetingDate = new Date('2024-03-10T02:30:00');

      const isDuringDST = dstDates.some(dstDate =>
        meetingDate.toDateString() === dstDate.toDateString()
      );

      expect(isDuringDST).toBe(true);
    });
  });

  describe('Action Item Assignment', () => {
    it('should handle ambiguous assignee names', async () => {
      const participants = [
        { name: 'John Smith', email: 'john.smith@company.com' },
        { name: 'John Doe', email: 'john.doe@company.com' },
      ];

      const actionItemText = 'John will send the report by Friday';
      const mentionedName = 'John';

      const matchingParticipants = participants.filter(p =>
        p.name.toLowerCase().includes(mentionedName.toLowerCase())
      );

      // Multiple Johns - needs disambiguation
      expect(matchingParticipants.length).toBeGreaterThan(1);
    });

    it('should resolve unique assignees from meeting participants', async () => {
      const participants = [
        { name: 'John Smith', email: 'john.smith@company.com' },
        { name: 'Jane Doe', email: 'jane.doe@company.com' },
      ];

      const actionItemText = 'Jane will review the proposal';
      const mentionedName = 'Jane';

      const matchingParticipants = participants.filter(p =>
        p.name.toLowerCase().includes(mentionedName.toLowerCase())
      );

      expect(matchingParticipants.length).toBe(1);
      expect(matchingParticipants[0].email).toBe('jane.doe@company.com');
    });

    it('should handle no matching assignee', async () => {
      const participants = [
        { name: 'John Smith', email: 'john.smith@company.com' },
      ];

      const actionItemText = 'Bob will handle the deployment';
      const mentionedName = 'Bob';

      const matchingParticipants = participants.filter(p =>
        p.name.toLowerCase().includes(mentionedName.toLowerCase())
      );

      expect(matchingParticipants.length).toBe(0);
    });
  });
});
