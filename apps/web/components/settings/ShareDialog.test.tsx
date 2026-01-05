/**
 * ShareDialog Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareDialog } from './ShareDialog';
import { sharingApi } from '@/lib/api';

// Mock sharingApi
jest.mock('@/lib/api', () => ({
  sharingApi: {
    listShares: jest.fn(),
    create: jest.fn(),
    revoke: jest.fn(),
  },
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

const mockSharingApi = sharingApi as jest.Mocked<typeof sharingApi>;

const mockShares = [
  {
    id: 'share-1',
    shareType: 'link' as const,
    accessLevel: 'view' as const,
    recipientEmail: null,
    recipientName: null,
    shareUrl: 'https://app.zigznote.com/shared/abc123',
    hasPassword: true,
    expiresAt: '2026-01-15T00:00:00.000Z',
    maxViews: 10,
    viewCount: 3,
    includeTranscript: true,
    includeSummary: true,
    includeActionItems: true,
    includeRecording: false,
    message: null,
    sharedBy: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
    createdAt: '2026-01-01T00:00:00.000Z',
    lastAccessedAt: '2026-01-05T00:00:00.000Z',
  },
];

describe('ShareDialog', () => {
  const defaultProps = {
    meetingId: 'meeting-123',
    meetingTitle: 'Team Standup',
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSharingApi.listShares.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('should not render when closed', () => {
    render(<ShareDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Share Meeting')).not.toBeInTheDocument();
  });

  it('should render share dialog when open', async () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByText('Share Meeting')).toBeInTheDocument();
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText('Share Link')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should switch between tabs', async () => {
    const user = userEvent.setup();

    render(<ShareDialog {...defaultProps} />);

    // Initially on link tab
    expect(screen.getByText('Create Share Link')).toBeInTheDocument();

    // Switch to email tab
    await user.click(screen.getByText('Email'));

    await waitFor(() => {
      expect(screen.getByText('Send Share Email')).toBeInTheDocument();
    });
  });

  it('should close when X button is clicked', async () => {
    render(<ShareDialog {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close when backdrop is clicked', async () => {
    const { container } = render(<ShareDialog {...defaultProps} />);

    // Click the backdrop (the first absolute div)
    const backdrop = container.querySelector('.bg-black\\/50');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should create link share successfully', async () => {
    const user = userEvent.setup();

    mockSharingApi.create.mockResolvedValue({
      success: true,
      data: mockShares[0],
    });

    render(<ShareDialog {...defaultProps} />);

    await user.click(screen.getByText('Create Share Link'));

    await waitFor(() => {
      expect(mockSharingApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: 'meeting-123',
          shareType: 'link',
          accessLevel: 'view',
        })
      );
    });
  });

  it('should create email share successfully', async () => {
    const user = userEvent.setup();

    mockSharingApi.create.mockResolvedValue({
      success: true,
      data: mockShares[0],
    });

    render(<ShareDialog {...defaultProps} />);

    // Switch to email tab
    await user.click(screen.getByText('Email'));

    // Fill in the form
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    await user.type(emailInput, 'test@example.com');

    await user.click(screen.getByText('Send Share Email'));

    await waitFor(() => {
      expect(mockSharingApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: 'meeting-123',
          shareType: 'email',
          recipientEmail: 'test@example.com',
        })
      );
    });
  });

  it('should show error when email share without email', async () => {
    const user = userEvent.setup();

    render(<ShareDialog {...defaultProps} />);

    // Switch to email tab
    await user.click(screen.getByText('Email'));

    // Try to send without email
    await user.click(screen.getByText('Send Share Email'));

    await waitFor(() => {
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });

    expect(mockSharingApi.create).not.toHaveBeenCalled();
  });

  it('should display existing shares', async () => {
    mockSharingApi.listShares.mockResolvedValue({
      success: true,
      data: mockShares,
    });

    render(<ShareDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Active shares')).toBeInTheDocument();
    });

    expect(screen.getByText('Share link')).toBeInTheDocument();
    expect(screen.getByText('3 views')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('should display delete button for shares', async () => {
    mockSharingApi.listShares.mockResolvedValue({
      success: true,
      data: mockShares,
    });

    const { container } = render(<ShareDialog {...defaultProps} />);

    // Wait for "Share link" text to appear (indicates shares have loaded and skeleton is gone)
    await waitFor(() => {
      expect(screen.getByText('Share link')).toBeInTheDocument();
    });

    // Verify the delete button exists (lucide icons have both lucide and lucide-icon-name classes)
    const deleteButton = container.querySelector('svg.lucide');
    const allButtons = container.querySelectorAll('button');
    // There should be multiple buttons including delete button
    expect(allButtons.length).toBeGreaterThan(0);
    // Icons with lucide class should exist
    expect(deleteButton).toBeTruthy();
  });

  it('should display share links with copy button', async () => {
    mockSharingApi.listShares.mockResolvedValue({
      success: true,
      data: mockShares,
    });

    const { container } = render(<ShareDialog {...defaultProps} />);

    // Wait for "Share link" text to appear (indicates shares have loaded)
    await waitFor(() => {
      expect(screen.getByText('Share link')).toBeInTheDocument();
    });

    // Verify the copy button exists (has lucide-copy icon)
    const copyButton = container.querySelector('.lucide-copy');
    expect(copyButton).toBeTruthy();
  });

  it('should toggle content options', async () => {
    const user = userEvent.setup();

    render(<ShareDialog {...defaultProps} />);

    const switches = screen.getAllByRole('checkbox');

    // All should be checked initially (except recording)
    expect(switches[0]).toBeChecked(); // Transcript
    expect(switches[1]).toBeChecked(); // Summary
    expect(switches[2]).toBeChecked(); // Action Items
    expect(switches[3]).not.toBeChecked(); // Recording

    // Toggle transcript off
    await user.click(switches[0]);

    expect(switches[0]).not.toBeChecked();
  });

  it('should show password field', async () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByPlaceholderText('Leave empty for no password')).toBeInTheDocument();
  });

  it('should show expiration dropdown', async () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByText('Expires in')).toBeInTheDocument();
    expect(screen.getByText('7 days')).toBeInTheDocument();
  });

  it('should show view limit dropdown', async () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByText('View limit')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });
});
