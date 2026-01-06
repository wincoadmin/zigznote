import { render, screen, fireEvent } from '@/tests/test-utils';
import { Sidebar } from './Sidebar';

// Mock usePathname
const mockPathname = jest.fn().mockReturnValue('/dashboard');
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockPathname(),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
  });

  it('should render logo text', () => {
    render(<Sidebar />);
    expect(screen.getByText('zig')).toBeInTheDocument();
    expect(screen.getByText('note')).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /meetings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('should highlight current route', () => {
    mockPathname.mockReturnValue('/meetings');
    render(<Sidebar />);

    const meetingsLink = screen.getByRole('link', { name: /meetings/i });
    expect(meetingsLink).toHaveClass('bg-primary-50', 'text-primary-700');
  });

  it('should highlight dashboard on dashboard path', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<Sidebar />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-primary-50', 'text-primary-700');
  });

  it('should highlight parent route for nested paths', () => {
    mockPathname.mockReturnValue('/meetings/123');
    render(<Sidebar />);

    const meetingsLink = screen.getByRole('link', { name: /meetings/i });
    expect(meetingsLink).toHaveClass('bg-primary-50', 'text-primary-700');
  });

  it('should collapse when toggle button is clicked', () => {
    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('w-56', 'sm:w-64');

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleButton);

    expect(sidebar).toHaveClass('w-14', 'sm:w-16');
  });

  it('should expand when clicking toggle in collapsed state', () => {
    render(<Sidebar />);

    // Collapse first
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    // Now expand
    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('w-56', 'sm:w-64');
  });

  it('should hide labels when collapsed', () => {
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should render user section', () => {
    render(<Sidebar />);

    expect(screen.getByText('User Name')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('should hide user details when collapsed', () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    expect(screen.queryByText('User Name')).not.toBeInTheDocument();
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });

  it('should navigate to correct routes', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /meetings/i })).toHaveAttribute('href', '/meetings');
    expect(screen.getByRole('link', { name: /calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /search/i })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('should apply custom className', () => {
    render(<Sidebar className="custom-sidebar" />);
    expect(screen.getByRole('complementary')).toHaveClass('custom-sidebar');
  });
});
