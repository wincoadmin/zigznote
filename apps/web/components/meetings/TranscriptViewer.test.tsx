import { render, screen, fireEvent } from '@/tests/test-utils';
import { TranscriptViewer } from './TranscriptViewer';

const mockSegments = [
  {
    id: 'seg-1',
    speaker: 'John Doe',
    text: 'Hello everyone, lets get started.',
    startMs: 0,
    endMs: 5000,
    confidence: 0.95,
  },
  {
    id: 'seg-2',
    speaker: 'Jane Smith',
    text: 'Sure, I have some updates to share.',
    startMs: 5000,
    endMs: 10000,
    confidence: 0.92,
  },
  {
    id: 'seg-3',
    speaker: 'John Doe',
    text: 'Great, please go ahead.',
    startMs: 10000,
    endMs: 15000,
    confidence: 0.98,
  },
];

describe('TranscriptViewer', () => {
  it('should render loading skeleton when isLoading is true', () => {
    render(<TranscriptViewer isLoading />);
    // Should show skeleton elements
    expect(document.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
  });

  it('should render empty state when no segments', () => {
    render(<TranscriptViewer segments={[]} />);
    expect(screen.getByText('No transcript available')).toBeInTheDocument();
  });

  it('should render all segments', () => {
    render(<TranscriptViewer segments={mockSegments} />);

    expect(screen.getByText('Hello everyone, lets get started.')).toBeInTheDocument();
    expect(screen.getByText('Sure, I have some updates to share.')).toBeInTheDocument();
    expect(screen.getByText('Great, please go ahead.')).toBeInTheDocument();
  });

  it('should render speaker names', () => {
    render(<TranscriptViewer segments={mockSegments} />);

    // John Doe appears twice
    expect(screen.getAllByText('John Doe')).toHaveLength(2);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should render timestamps', () => {
    render(<TranscriptViewer segments={mockSegments} />);

    // Should show timestamps like 0:00, 0:05, 0:10
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });

  it('should highlight current segment based on currentTimeMs', () => {
    const { container } = render(
      <TranscriptViewer segments={mockSegments} currentTimeMs={7500} />
    );

    // Segment 2 (5000-10000ms) should be active
    const activeSegment = container.querySelector('[data-segment-index="1"]');
    expect(activeSegment).toHaveClass('ring-2', 'ring-primary-500');
  });

  it('should call onSegmentClick when a segment is clicked', () => {
    const handleClick = jest.fn();
    render(<TranscriptViewer segments={mockSegments} onSegmentClick={handleClick} />);

    // Click on the second segment
    fireEvent.click(screen.getByText('Sure, I have some updates to share.'));

    expect(handleClick).toHaveBeenCalledWith(5000);
  });

  it('should call onSegmentClick when timestamp is clicked', () => {
    const handleClick = jest.fn();
    render(<TranscriptViewer segments={mockSegments} onSegmentClick={handleClick} />);

    // Click on a timestamp
    fireEvent.click(screen.getByText('0:05'));

    expect(handleClick).toHaveBeenCalledWith(5000);
  });

  it('should render search input', () => {
    render(<TranscriptViewer segments={mockSegments} />);
    expect(screen.getByPlaceholderText('Search transcript...')).toBeInTheDocument();
  });

  it('should filter segments based on search query', () => {
    render(<TranscriptViewer segments={mockSegments} />);

    const searchInput = screen.getByPlaceholderText('Search transcript...');
    fireEvent.change(searchInput, { target: { value: 'updates' } });

    // Only Jane's segment should be visible (text is split by <mark> for highlighting)
    expect(screen.getByText(/Sure, I have some/)).toBeInTheDocument();
    expect(screen.getByText(/updates/)).toBeInTheDocument();
    expect(screen.queryByText('Hello everyone, lets get started.')).not.toBeInTheDocument();
    expect(screen.queryByText('Great, please go ahead.')).not.toBeInTheDocument();
  });

  it('should highlight search matches', () => {
    const { container } = render(<TranscriptViewer segments={mockSegments} />);

    const searchInput = screen.getByPlaceholderText('Search transcript...');
    fireEvent.change(searchInput, { target: { value: 'updates' } });

    // Should have a highlighted mark element
    const mark = container.querySelector('mark');
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent('updates');
  });

  it('should apply different colors to different speakers', () => {
    const { container } = render(<TranscriptViewer segments={mockSegments} />);

    const segments = container.querySelectorAll('[data-segment-index]');

    // All three segments should be rendered
    expect(segments.length).toBe(3);

    // Each segment should have the expected base classes
    segments.forEach((segment) => {
      expect(segment).toHaveClass('cursor-pointer', 'rounded-lg', 'border-l-4', 'p-3');
    });
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TranscriptViewer segments={mockSegments} className="custom-transcript" />
    );

    expect(container.firstChild).toHaveClass('custom-transcript');
  });
});
