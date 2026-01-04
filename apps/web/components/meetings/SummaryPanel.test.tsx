import { render, screen, fireEvent, waitFor, createMockSummary } from '@/tests/test-utils';
import { SummaryPanel } from './SummaryPanel';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('SummaryPanel', () => {
  const mockSummary = createMockSummary('meeting-1');

  beforeEach(() => {
    (navigator.clipboard.writeText as jest.Mock).mockClear();
  });

  it('should render loading skeleton when isLoading is true', () => {
    render(<SummaryPanel isLoading />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('should render empty state when no summary', () => {
    render(<SummaryPanel summary={null} />);
    expect(screen.getByText('No summary available yet')).toBeInTheDocument();
  });

  it('should render Generate button when no summary and onRegenerate provided', () => {
    const handleRegenerate = jest.fn();
    render(<SummaryPanel summary={null} onRegenerate={handleRegenerate} />);

    const generateButton = screen.getByRole('button', { name: /Generate/i });
    expect(generateButton).toBeInTheDocument();

    fireEvent.click(generateButton);
    expect(handleRegenerate).toHaveBeenCalled();
  });

  it('should render summary content', () => {
    render(<SummaryPanel summary={mockSummary} />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText(mockSummary.content.executiveSummary)).toBeInTheDocument();
  });

  it('should render Regenerate button when summary exists and onRegenerate provided', () => {
    const handleRegenerate = jest.fn();
    render(<SummaryPanel summary={mockSummary} onRegenerate={handleRegenerate} />);

    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
  });

  it('should call onRegenerate when Regenerate button is clicked', () => {
    const handleRegenerate = jest.fn();
    render(<SummaryPanel summary={mockSummary} onRegenerate={handleRegenerate} />);

    fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));
    expect(handleRegenerate).toHaveBeenCalled();
  });

  it('should disable Regenerate button when isRegenerating is true', () => {
    render(
      <SummaryPanel
        summary={mockSummary}
        onRegenerate={() => {}}
        isRegenerating
      />
    );

    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeDisabled();
  });

  it('should render tabs for Summary, Topics, and Decisions', () => {
    render(<SummaryPanel summary={mockSummary} />);

    expect(screen.getByRole('tab', { name: /Summary/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Topics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Decisions/i })).toBeInTheDocument();
  });

  it('should switch to Topics tab and show topics', () => {
    render(<SummaryPanel summary={mockSummary} />);

    fireEvent.click(screen.getByRole('tab', { name: /Topics/i }));

    expect(screen.getByText('Dashboard Progress')).toBeInTheDocument();
    expect(screen.getByText('Jane completed the main dashboard layout.')).toBeInTheDocument();
  });

  it('should switch to Decisions tab and show decisions', () => {
    render(<SummaryPanel summary={mockSummary} />);

    fireEvent.click(screen.getByRole('tab', { name: /Decisions/i }));

    expect(screen.getByText('Proceed with the current design approach')).toBeInTheDocument();
    expect(screen.getByText('Schedule a demo for Friday')).toBeInTheDocument();
  });

  it('should show empty state for topics when none exist', () => {
    const summaryNoTopics = {
      ...mockSummary,
      content: { ...mockSummary.content, topics: [] },
    };
    render(<SummaryPanel summary={summaryNoTopics} />);

    fireEvent.click(screen.getByRole('tab', { name: /Topics/i }));
    expect(screen.getByText('No topics extracted')).toBeInTheDocument();
  });

  it('should show empty state for decisions when none exist', () => {
    const summaryNoDecisions = {
      ...mockSummary,
      content: { ...mockSummary.content, decisions: [] },
    };
    render(<SummaryPanel summary={summaryNoDecisions} />);

    fireEvent.click(screen.getByRole('tab', { name: /Decisions/i }));
    expect(screen.getByText('No decisions recorded')).toBeInTheDocument();
  });

  it('should copy summary to clipboard when copy button is clicked', async () => {
    render(<SummaryPanel summary={mockSummary} />);

    // Find and click the copy button
    const copyButton = screen.getByRole('button', { name: '' }); // Icon button
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockSummary.content.executiveSummary
      );
    });
  });

  it('should apply custom className', () => {
    const { container } = render(
      <SummaryPanel summary={mockSummary} className="custom-summary" />
    );

    expect(container.firstChild).toHaveClass('custom-summary');
  });
});
