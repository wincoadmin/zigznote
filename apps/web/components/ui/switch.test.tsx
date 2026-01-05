/**
 * Switch Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './switch';

describe('Switch', () => {
  it('should render unchecked by default', () => {
    render(<Switch />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('should render checked when checked prop is true', () => {
    render(<Switch checked onChange={() => {}} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should toggle when clicked', () => {
    const handleChange = jest.fn();
    render(<Switch onChange={handleChange} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should render with label', () => {
    render(<Switch label="Enable notifications" />);

    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
  });

  it('should render with description', () => {
    render(
      <Switch
        label="Enable notifications"
        description="Get notified when meetings are ready"
      />
    );

    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    expect(screen.getByText('Get notified when meetings are ready')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Switch disabled />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('should have correct size classes for sm size', () => {
    const { container } = render(<Switch size="sm" />);

    const track = container.querySelector('label');
    expect(track).toHaveClass('h-5', 'w-9');
  });

  it('should have correct size classes for md size', () => {
    const { container } = render(<Switch size="md" />);

    const track = container.querySelector('label');
    expect(track).toHaveClass('h-6', 'w-11');
  });

  it('should accept custom className', () => {
    const { container } = render(<Switch className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should use provided id', () => {
    render(<Switch id="custom-id" label="Test" />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('id', 'custom-id');

    const label = screen.getByText('Test');
    expect(label).toHaveAttribute('for', 'custom-id');
  });

  it('should generate random id when not provided', () => {
    render(<Switch label="Test" />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.id).toMatch(/^switch-/);
  });

  it('should be focusable for accessibility', () => {
    render(<Switch />);

    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();

    expect(document.activeElement).toBe(checkbox);
  });
});
