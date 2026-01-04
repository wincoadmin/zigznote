import { render, screen } from '@/tests/test-utils';
import { StatsCards } from './StatsCards';

describe('StatsCards', () => {
  const mockStats = {
    meetingsThisWeek: 12,
    hoursRecorded: 24,
    actionItemsPending: 5,
    completionRate: 85,
  };

  it('should render loading skeletons when isLoading is true', () => {
    render(<StatsCards isLoading />);

    // Should have skeleton elements with animate-shimmer class
    expect(document.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
  });

  it('should render all stat cards with data', () => {
    render(<StatsCards stats={mockStats} />);

    expect(screen.getByText('Meetings This Week')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('Hours Recorded')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();

    expect(screen.getByText('Action Items Pending')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should render change indicators', () => {
    render(<StatsCards stats={mockStats} />);

    expect(screen.getByText('+12% from last week')).toBeInTheDocument();
    expect(screen.getByText('+5% from last week')).toBeInTheDocument();
    expect(screen.getByText('3 due today')).toBeInTheDocument();
    expect(screen.getByText('+8% improvement')).toBeInTheDocument();
  });

  it('should render with default values when stats is undefined', () => {
    render(<StatsCards />);

    // Multiple 0s may appear, just check they exist
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('0h')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should render in a 4-column grid on large screens', () => {
    render(<StatsCards stats={mockStats} />);

    const grid = document.querySelector('.grid.gap-4');
    expect(grid).toHaveClass('lg:grid-cols-4');
  });

  it('should render trend icons for upward trends', () => {
    render(<StatsCards stats={mockStats} />);

    // Check for green color classes on trend up items
    const trendItems = document.querySelectorAll('.text-green-600');
    expect(trendItems.length).toBeGreaterThan(0);
  });

  it('should render neutral trend without up/down styling', () => {
    render(<StatsCards stats={mockStats} />);

    // Action Items Pending should have neutral trend
    const neutralItem = screen.getByText('3 due today');
    expect(neutralItem).toHaveClass('text-slate-500');
  });
});
