/**
 * NotificationSettings Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationSettings } from './NotificationSettings';
import { settingsApi } from '@/lib/api';

// Mock settingsApi
jest.mock('@/lib/api', () => ({
  settingsApi: {
    getNotifications: jest.fn(),
    updateNotifications: jest.fn(),
  },
}));

const mockSettingsApi = settingsApi as jest.Mocked<typeof settingsApi>;

const mockPreferences = {
  emailMeetingReady: true,
  emailActionItemReminder: true,
  emailWeeklyDigest: false,
  emailMeetingShared: true,
  emailPaymentAlerts: true,
  actionItemReminderDays: 2,
};

describe('NotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', async () => {
    mockSettingsApi.getNotifications.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<NotificationSettings />);

    // Should show skeleton loaders (animate-shimmer class)
    await waitFor(() => {
      expect(container.querySelector('.animate-shimmer')).toBeTruthy();
    });
  });

  it('should render notification preferences after loading', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('Meeting ready')).toBeInTheDocument();
    expect(screen.getByText('Action item reminders')).toBeInTheDocument();
    expect(screen.getByText('Weekly digest')).toBeInTheDocument();
    expect(screen.getByText('Meeting shared')).toBeInTheDocument();
    expect(screen.getByText('Payment alerts')).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: false,
      error: { code: 'ERROR', message: 'Failed' },
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument();
    });
  });

  it('should toggle notification preference', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: true,
      data: mockPreferences,
    });
    mockSettingsApi.updateNotifications.mockResolvedValue({
      success: true,
      data: { ...mockPreferences, emailMeetingReady: false },
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Meeting ready')).toBeInTheDocument();
    });

    // Find the first switch (meeting ready)
    const switches = screen.getAllByRole('checkbox');
    const meetingReadySwitch = switches[0];

    expect(meetingReadySwitch).toBeChecked();

    fireEvent.click(meetingReadySwitch);

    await waitFor(() => {
      expect(mockSettingsApi.updateNotifications).toHaveBeenCalledWith({
        emailMeetingReady: false,
      });
    });
  });

  it('should show reminder days select when action item reminders is enabled', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Action item reminders')).toBeInTheDocument();
    });

    // Should show the reminder days dropdown
    expect(screen.getByText('2 days before')).toBeInTheDocument();
  });

  it('should hide reminder days select when action item reminders is disabled', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: true,
      data: { ...mockPreferences, emailActionItemReminder: false },
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Action item reminders')).toBeInTheDocument();
    });

    // Should not show the reminder days dropdown
    expect(screen.queryByText('2 days before')).not.toBeInTheDocument();
  });

  it('should revert preference on update failure', async () => {
    mockSettingsApi.getNotifications.mockResolvedValue({
      success: true,
      data: mockPreferences,
    });
    mockSettingsApi.updateNotifications.mockResolvedValue({
      success: false,
      error: { code: 'ERROR', message: 'Failed' },
    });

    render(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText('Meeting ready')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('checkbox');
    const meetingReadySwitch = switches[0];

    fireEvent.click(meetingReadySwitch);

    await waitFor(() => {
      expect(screen.getByText('Failed to save preference')).toBeInTheDocument();
    });
  });
});
