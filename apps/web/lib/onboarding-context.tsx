'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

interface OnboardingState {
  showWizard: boolean;
  showChecklist: boolean;
  completedSteps: string[];
  dismissed: boolean;
}

interface OnboardingContextType {
  state: OnboardingState;
  startOnboarding: () => void;
  completeStep: (stepId: string) => void;
  completeOnboarding: () => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
  isStepCompleted: (stepId: string) => boolean;
}

const STORAGE_KEY = 'zigznote_onboarding';

const defaultState: OnboardingState = {
  showWizard: false,
  showChecklist: true,
  completedSteps: [],
  dismissed: false,
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(parsed);
      } else {
        // First time user - show wizard
        setState({ ...defaultState, showWizard: true });
      }
    } catch {
      setState({ ...defaultState, showWizard: true });
    }
    setIsLoaded(true);
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const startOnboarding = useCallback(() => {
    setState((prev) => ({ ...prev, showWizard: true }));
  }, []);

  const completeStep = useCallback((stepId: string) => {
    setState((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(stepId)
        ? prev.completedSteps
        : [...prev.completedSteps, stepId],
    }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showWizard: false,
      showChecklist: true,
    }));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showWizard: false,
      showChecklist: false,
      dismissed: true,
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    setState({ ...defaultState, showWizard: true });
  }, []);

  const isStepCompleted = useCallback(
    (stepId: string) => state.completedSteps.includes(stepId),
    [state.completedSteps]
  );

  // Don't render children until state is loaded to prevent hydration issues
  if (!isLoaded) {
    return null;
  }

  return (
    <OnboardingContext.Provider
      value={{
        state,
        startOnboarding,
        completeStep,
        completeOnboarding,
        dismissOnboarding,
        resetOnboarding,
        isStepCompleted,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
