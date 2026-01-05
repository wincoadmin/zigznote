/**
 * UsageQuotaDisplay Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import { UsageQuotaDisplay } from './UsageQuotaDisplay';
import { settingsApi } from '@/lib/api';

// Mock settingsApi
jest.mock('@/lib/api', () => ({
  settingsApi: {
    getUsage: jest.fn(),
  },
}));

const mockSettingsApi = settingsApi as jest.Mocked<typeof settingsApi>;

const mockUsageSummary = {
  period: '2026-01',
  plan: 'pro',
  usage: {
    meetings: {
      current: 25,
      limit: 100,
      percentage: 25,
    },
    minutes: {
      current: 500,
      limit: 3000,
      percentage: 16.67,
    },
    storage: {
      current: 1073741824, // 1GB
      limit: 10737418240, // 10GB
      percentage: 10,
    },
    chat: {
      current: 5000,
      limit: 100000,
      percentage: 5,
    },
  },
};

describe('UsageQuotaDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', async () => {
    mockSettingsApi.getUsage.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<UsageQuotaDisplay />);

    // Component should be rendering (loading) - Skeleton has animate-shimmer class
    await waitFor(() => {
      expect(container.querySelector('.animate-shimmer')).toBeTruthy();
    });
  });

  it('should render usage data after loading', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: mockUsageSummary,
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Usage & Quotas')).toBeInTheDocument();
    });

    expect(screen.getByText('Meetings')).toBeInTheDocument();
    expect(screen.getByText('Meeting Minutes')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('AI Chat Tokens')).toBeInTheDocument();
    expect(screen.getByText('pro Plan')).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: false,
      error: { code: 'ERROR', message: 'Failed' },
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load usage data')).toBeInTheDocument();
    });
  });

  it('should show warning badge when quota is high', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: {
        ...mockUsageSummary,
        usage: {
          ...mockUsageSummary.usage,
          meetings: {
            current: 85,
            limit: 100,
            percentage: 85,
          },
        },
      },
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Almost full')).toBeInTheDocument();
    });
  });

  it('should show over limit badge when quota exceeded', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: {
        ...mockUsageSummary,
        usage: {
          ...mockUsageSummary.usage,
          meetings: {
            current: 120,
            limit: 100,
            percentage: 120,
          },
        },
      },
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Over limit')).toBeInTheDocument();
    });
  });

  it('should render compact mode correctly', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: mockUsageSummary,
    });

    render(<UsageQuotaDisplay compact />);

    await waitFor(() => {
      expect(screen.getByText('Usage & Quotas')).toBeInTheDocument();
    });

    // Compact mode should show data inline
    expect(screen.getByText('25 / 100')).toBeInTheDocument();
  });

  it('should show upgrade CTA for free plan', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: {
        ...mockUsageSummary,
        plan: 'free',
      },
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Need more capacity?')).toBeInTheDocument();
    });

    expect(screen.getByText('View pricing →')).toBeInTheDocument();
  });

  it('should not show upgrade CTA for paid plans', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: mockUsageSummary,
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Usage & Quotas')).toBeInTheDocument();
    });

    expect(screen.queryByText('Need more capacity?')).not.toBeInTheDocument();
  });

  it('should handle unlimited quotas', async () => {
    mockSettingsApi.getUsage.mockResolvedValue({
      success: true,
      data: {
        ...mockUsageSummary,
        plan: 'enterprise',
        usage: {
          ...mockUsageSummary.usage,
          meetings: {
            current: 500,
            limit: -1,
            percentage: 0,
          },
        },
      },
    });

    render(<UsageQuotaDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Unlimited')).toBeInTheDocument();
    });
  });
});
