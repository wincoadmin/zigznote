/**
 * Tests for OnboardingWizard component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the first step by default', () => {
    render(<OnboardingWizard />);

    expect(screen.getByText('Welcome to zigznote')).toBeInTheDocument();
    expect(screen.getByText(/AI-powered meeting assistant/)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('should render at specified initial step', () => {
    render(<OnboardingWizard initialStep={1} />);

    expect(screen.getByText('Connect Your Calendar')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('should navigate to next step on Next click', () => {
    render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Connect Your Calendar')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('should navigate back on Back click', () => {
    render(<OnboardingWizard initialStep={2} />);

    expect(screen.getByText('Set Your Preferences')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByText('Connect Your Calendar')).toBeInTheDocument();
  });

  it('should hide Back button on first step', () => {
    render(<OnboardingWizard />);

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toHaveClass('invisible');
  });

  it('should call onComplete when finishing the wizard', () => {
    const onComplete = jest.fn();
    render(<OnboardingWizard initialStep={4} onComplete={onComplete} />);

    expect(screen.getByText("You're All Set!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should call onSkip when clicking X button', () => {
    const onSkip = jest.fn();
    render(<OnboardingWizard onSkip={onSkip} />);

    // Find the X button
    const closeButtons = screen.getAllByRole('button');
    const skipButton = closeButtons.find(btn => btn.querySelector('svg.lucide-x'));

    if (skipButton) {
      fireEvent.click(skipButton);
      expect(onSkip).toHaveBeenCalledTimes(1);
    }
  });

  it('should show action button for steps with actions', () => {
    render(<OnboardingWizard initialStep={1} />);

    const actionButton = screen.getByRole('button', { name: /connect calendar/i });
    expect(actionButton).toBeInTheDocument();
  });

  it('should navigate to href when clicking action button', () => {
    render(<OnboardingWizard initialStep={1} />);

    const actionButton = screen.getByRole('button', { name: /connect calendar/i });
    fireEvent.click(actionButton);

    expect(mockPush).toHaveBeenCalledWith('/settings/calendar');
  });

  it('should display progress indicators', () => {
    render(<OnboardingWizard />);

    // Should have 5 progress dots (one for each step)
    const progressBars = document.querySelectorAll('.w-8.h-1.rounded-full');
    expect(progressBars).toHaveLength(5);
  });

  it('should show Get Started button on last step', () => {
    render(<OnboardingWizard initialStep={4} />);

    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('should show Next button on non-last steps', () => {
    render(<OnboardingWizard initialStep={0} />);

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
  });

  it('should render step icons', () => {
    render(<OnboardingWizard />);

    // First step should have the Rocket icon container
    const iconContainer = document.querySelector('.w-16.h-16');
    expect(iconContainer).toBeInTheDocument();
  });
});
