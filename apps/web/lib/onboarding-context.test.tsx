/**
 * Tests for onboarding-context
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { OnboardingProvider, useOnboarding } from './onboarding-context';

// Mock localStorage
interface LocalStorageMock {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const localStorageMock: LocalStorageMock = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string): string | null => localStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('OnboardingProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  function TestComponent() {
    const { state } = useOnboarding();
    return (
      <div>
        <span data-testid="showWizard">{state.showWizard.toString()}</span>
        <span data-testid="showChecklist">{state.showChecklist.toString()}</span>
        <span data-testid="dismissed">{state.dismissed.toString()}</span>
        <span data-testid="steps">{state.completedSteps.join(',')}</span>
      </div>
    );
  }

  it('should show wizard for first-time users', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('showWizard')).toHaveTextContent('true');
    });
  });

  it('should load state from localStorage', async () => {
    localStorageMock.store['zigznote_onboarding'] = JSON.stringify({
      showWizard: false,
      showChecklist: true,
      completedSteps: ['step1', 'step2'],
      dismissed: false,
    });

    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('showWizard')).toHaveTextContent('false');
      expect(screen.getByTestId('steps')).toHaveTextContent('step1,step2');
    });
  });

  it('should persist state to localStorage', async () => {
    function CompleteStepComponent() {
      const { completeStep, state } = useOnboarding();
      return (
        <div>
          <button onClick={() => completeStep('test-step')}>Complete Step</button>
          <span data-testid="steps">{state.completedSteps.join(',')}</span>
        </div>
      );
    }

    render(
      <OnboardingProvider>
        <CompleteStepComponent />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole('button').click();
    });

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});

describe('useOnboarding hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <OnboardingProvider>{children}</OnboardingProvider>
  );

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useOnboarding());
    }).toThrow('useOnboarding must be used within OnboardingProvider');

    consoleError.mockRestore();
  });

  it('should provide startOnboarding function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.startOnboarding).toBeDefined();
    });

    act(() => {
      result.current.startOnboarding();
    });

    expect(result.current.state.showWizard).toBe(true);
  });

  it('should provide completeStep function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.completeStep).toBeDefined();
    });

    act(() => {
      result.current.completeStep('calendar');
    });

    expect(result.current.state.completedSteps).toContain('calendar');
  });

  it('should not duplicate completed steps', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.completeStep).toBeDefined();
    });

    act(() => {
      result.current.completeStep('calendar');
      result.current.completeStep('calendar');
    });

    const calendarCount = result.current.state.completedSteps.filter(
      (s) => s === 'calendar'
    ).length;
    expect(calendarCount).toBe(1);
  });

  it('should provide completeOnboarding function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.completeOnboarding).toBeDefined();
    });

    act(() => {
      result.current.startOnboarding();
    });

    expect(result.current.state.showWizard).toBe(true);

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.state.showWizard).toBe(false);
    expect(result.current.state.showChecklist).toBe(true);
  });

  it('should provide dismissOnboarding function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.dismissOnboarding).toBeDefined();
    });

    act(() => {
      result.current.dismissOnboarding();
    });

    expect(result.current.state.showWizard).toBe(false);
    expect(result.current.state.showChecklist).toBe(false);
    expect(result.current.state.dismissed).toBe(true);
  });

  it('should provide resetOnboarding function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.resetOnboarding).toBeDefined();
    });

    act(() => {
      result.current.completeStep('step1');
      result.current.dismissOnboarding();
    });

    act(() => {
      result.current.resetOnboarding();
    });

    expect(result.current.state.completedSteps).toEqual([]);
    expect(result.current.state.showWizard).toBe(true);
    expect(result.current.state.dismissed).toBe(false);
  });

  it('should provide isStepCompleted function', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isStepCompleted).toBeDefined();
    });

    expect(result.current.isStepCompleted('calendar')).toBe(false);

    act(() => {
      result.current.completeStep('calendar');
    });

    expect(result.current.isStepCompleted('calendar')).toBe(true);
    expect(result.current.isStepCompleted('other')).toBe(false);
  });
});
