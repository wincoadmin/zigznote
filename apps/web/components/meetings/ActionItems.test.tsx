import { render, screen, fireEvent, waitFor, createMockActionItems } from '@/tests/test-utils';
import { ActionItems } from './ActionItems';

describe('ActionItems', () => {
  const mockActionItems = createMockActionItems('meeting-1');

  it('should render loading skeleton when isLoading is true', () => {
    render(<ActionItems isLoading />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('should render empty state when no action items', () => {
    render(<ActionItems actionItems={[]} />);
    expect(screen.getByText('No action items for this meeting')).toBeInTheDocument();
  });

  it('should render action items', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    expect(screen.getByText('Complete the testing suite')).toBeInTheDocument();
    expect(screen.getByText('Update documentation')).toBeInTheDocument();
  });

  it('should show pending count', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    // 1 pending item (the first one is not completed)
    expect(screen.getByText('1 pending')).toBeInTheDocument();
  });

  it('should show completed section header', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    expect(screen.getByText(/Completed \(1\)/)).toBeInTheDocument();
  });

  it('should display assignee when available', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display due date when available', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    // Check for formatted dates
    expect(screen.getByText(/Jan 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 8/i)).toBeInTheDocument();
  });

  it('should call onToggle when checkbox is clicked', async () => {
    const handleToggle = jest.fn();
    render(<ActionItems actionItems={mockActionItems} onToggle={handleToggle} />);

    // Find the first checkbox (pending item)
    const checkboxes = screen.getAllByTestId('action-item-checkbox');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(handleToggle).toHaveBeenCalledWith('action-1', true);
    });
  });

  it('should call onToggle to uncheck completed item', async () => {
    const handleToggle = jest.fn();
    render(<ActionItems actionItems={mockActionItems} onToggle={handleToggle} />);

    // Find the completed item checkbox (second one)
    const checkboxes = screen.getAllByTestId('action-item-checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(handleToggle).toHaveBeenCalledWith('action-2', false);
    });
  });

  it('should call onDelete when delete button is clicked', () => {
    const handleDelete = jest.fn();
    render(<ActionItems actionItems={mockActionItems} onDelete={handleDelete} />);

    // Find and click the first delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete action item/i });
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith('action-1');
  });

  it('should not render delete buttons when onDelete is not provided', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    expect(screen.queryByRole('button', { name: /delete action item/i })).not.toBeInTheDocument();
  });

  it('should show strikethrough on completed items', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    // The completed item text should have line-through class
    const completedItem = screen.getByText('Update documentation');
    expect(completedItem).toHaveClass('line-through');
  });

  it('should not show strikethrough on pending items', () => {
    render(<ActionItems actionItems={mockActionItems} />);

    const pendingItem = screen.getByText('Complete the testing suite');
    expect(pendingItem).not.toHaveClass('line-through');
  });

  it('should show check icon for completed items', () => {
    const { container } = render(<ActionItems actionItems={mockActionItems} />);

    // Completed items should have a check icon
    const completedCheckbox = container.querySelectorAll('[data-testid="action-item-checkbox"]')[1];
    const checkIcon = completedCheckbox?.querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ActionItems actionItems={mockActionItems} className="custom-actions" />
    );

    expect(container.firstChild).toHaveClass('custom-actions');
  });

  it('should render all pending items before completed items', () => {
    const { container } = render(<ActionItems actionItems={mockActionItems} />);

    const items = container.querySelectorAll('[data-testid="action-item-checkbox"]');

    // First item should be pending (no strikethrough on its text)
    const firstItemText = items[0]?.closest('.group')?.querySelector('p');
    expect(firstItemText).not.toHaveClass('line-through');

    // Second item should be completed (has strikethrough)
    const secondItemText = items[1]?.closest('.group')?.querySelector('p');
    expect(secondItemText).toHaveClass('line-through');
  });
});
