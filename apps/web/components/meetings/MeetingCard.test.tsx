import { render, screen, fireEvent, createMockMeeting } from '@/tests/test-utils';
import { MeetingCard } from './MeetingCard';

describe('MeetingCard', () => {
  const defaultMeeting = createMockMeeting();
  const defaultParticipants = [
    { id: 'p1', name: 'John Doe', email: 'john@example.com', meetingId: 'meeting-1', isHost: true, speakerLabel: undefined },
    { id: 'p2', name: 'Jane Smith', email: 'jane@example.com', meetingId: 'meeting-1', isHost: false, speakerLabel: undefined },
  ];

  it('should render meeting title', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    expect(screen.getByText('Weekly Standup')).toBeInTheDocument();
  });

  it('should render meeting title as a link', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    const link = screen.getByRole('link', { name: /Weekly Standup/i });
    expect(link).toHaveAttribute('href', '/meetings/meeting-1');
  });

  it('should render completed status badge', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should render scheduled status correctly', () => {
    const scheduledMeeting = createMockMeeting({ status: 'scheduled' });
    render(<MeetingCard meeting={scheduledMeeting} />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('should render recording status correctly', () => {
    const recordingMeeting = createMockMeeting({ status: 'recording' });
    render(<MeetingCard meeting={recordingMeeting} />);
    expect(screen.getByText('Recording')).toBeInTheDocument();
  });

  it('should render processing status correctly', () => {
    const processingMeeting = createMockMeeting({ status: 'processing' });
    render(<MeetingCard meeting={processingMeeting} />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('should render failed status correctly', () => {
    const failedMeeting = createMockMeeting({ status: 'failed' });
    render(<MeetingCard meeting={failedMeeting} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should display formatted date and time', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    // Date formatting check - the date should be formatted
    expect(screen.getByText(/Jan/i)).toBeInTheDocument();
  });

  it('should display duration when available', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    expect(screen.getByText(/1h/i)).toBeInTheDocument();
  });

  it('should display "No date scheduled" when startTime is not available', () => {
    const noDateMeeting = createMockMeeting({ startTime: null });
    render(<MeetingCard meeting={noDateMeeting} />);
    expect(screen.getByText('No date scheduled')).toBeInTheDocument();
  });

  it('should display participants when provided', () => {
    render(<MeetingCard meeting={defaultMeeting} participants={defaultParticipants} />);
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  it('should display singular participant text for single participant', () => {
    const singleParticipant = [{ id: 'p1', name: 'John Doe', email: 'john@example.com', meetingId: 'meeting-1', isHost: true, speakerLabel: undefined }];
    render(<MeetingCard meeting={defaultMeeting} participants={singleParticipant} />);
    expect(screen.getByText('1 participant')).toBeInTheDocument();
  });

  it('should not display participants section when empty', () => {
    render(<MeetingCard meeting={defaultMeeting} participants={[]} />);
    expect(screen.queryByText(/participant/i)).not.toBeInTheDocument();
  });

  it('should have View Details link', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    const viewDetailsLink = screen.getByRole('link', { name: /View Details/i });
    expect(viewDetailsLink).toHaveAttribute('href', '/meetings/meeting-1');
  });

  it('should call onDelete when delete button is clicked', () => {
    const handleDelete = jest.fn();
    render(<MeetingCard meeting={defaultMeeting} onDelete={handleDelete} />);

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('meeting-1');
  });

  it('should not render delete button when onDelete is not provided', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('should render video icon', () => {
    render(<MeetingCard meeting={defaultMeeting} />);
    // Check for the platform icon container
    const container = document.querySelector('.rounded-lg.flex.items-center.justify-center');
    expect(container).toBeInTheDocument();
  });
});
