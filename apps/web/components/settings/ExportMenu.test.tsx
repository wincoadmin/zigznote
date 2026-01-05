/**
 * ExportMenu Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from './ExportMenu';
import { meetingExportApi } from '@/lib/api';

// Mock meetingExportApi
jest.mock('@/lib/api', () => ({
  meetingExportApi: {
    export: jest.fn(),
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

const mockMeetingExportApi = meetingExportApi as jest.Mocked<typeof meetingExportApi>;

describe('ExportMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:http://localhost/mock-blob');
  });

  it('should render export button', () => {
    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should open menu when button is clicked', async () => {
    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });

    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByText('Word Document')).toBeInTheDocument();
    expect(screen.getByText('SRT Subtitles')).toBeInTheDocument();
    expect(screen.getByText('Plain Text')).toBeInTheDocument();
    expect(screen.getByText('JSON Data')).toBeInTheDocument();
  });

  it('should show options panel when format is selected', async () => {
    const user = userEvent.setup();

    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('PDF Document'));

    await waitFor(() => {
      expect(screen.getByText('Include summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Include action items')).toBeInTheDocument();
    expect(screen.getByText('Include transcript')).toBeInTheDocument();
  });

  it('should go back when back button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('PDF Document'));

    await waitFor(() => {
      expect(screen.getByText('← Back')).toBeInTheDocument();
    });

    await user.click(screen.getByText('← Back'));

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });
  });

  it('should trigger export when export button is clicked', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['test content'], { type: 'text/html' });
    mockMeetingExportApi.export.mockResolvedValue(mockBlob);

    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('PDF Document'));

    await waitFor(() => {
      expect(screen.getByText('Export as PDF Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export as PDF Document'));

    await waitFor(() => {
      expect(mockMeetingExportApi.export).toHaveBeenCalledWith('meeting-123', {
        format: 'pdf',
        includeTranscript: true,
        includeSummary: true,
        includeActionItems: true,
        includeSpeakerNames: true,
        includeTimestamps: true,
      });
    });
  });

  it('should not show SRT/TXT options when no transcript', () => {
    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
        hasTranscript={false}
      />
    );

    fireEvent.click(screen.getByText('Export'));

    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.queryByText('SRT Subtitles')).not.toBeInTheDocument();
    expect(screen.queryByText('Plain Text')).not.toBeInTheDocument();
  });

  it('should close menu when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ExportMenu
          meetingId="meeting-123"
          meetingTitle="Team Standup"
        />
      </div>
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText('Export Format')).not.toBeInTheDocument();
    });
  });

  it('should toggle export options', async () => {
    const user = userEvent.setup();

    render(
      <ExportMenu
        meetingId="meeting-123"
        meetingTitle="Team Standup"
      />
    );

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('PDF Document'));

    await waitFor(() => {
      expect(screen.getByText('Include summary')).toBeInTheDocument();
    });

    // Toggle off "Include summary"
    const summarySwitch = screen.getAllByRole('checkbox')[0];
    expect(summarySwitch).toBeChecked();

    await user.click(summarySwitch);

    expect(summarySwitch).not.toBeChecked();
  });
});
