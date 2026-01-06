'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Rocket,
  Settings,
  Video,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  completed?: boolean;
}

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
  initialStep?: number;
}

const defaultSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to zigznote',
    description: 'Your AI-powered meeting assistant is ready to help you capture, understand, and act on your meetings.',
    icon: <Rocket className="w-8 h-8" />,
  },
  {
    id: 'calendar',
    title: 'Connect Your Calendar',
    description: 'Link your Google or Microsoft calendar to automatically detect and join your meetings.',
    icon: <Calendar className="w-8 h-8" />,
    action: {
      label: 'Connect Calendar',
      href: '/settings/calendar',
    },
  },
  {
    id: 'preferences',
    title: 'Set Your Preferences',
    description: 'Configure how zigznote should handle your meetings - auto-join, notifications, and more.',
    icon: <Settings className="w-8 h-8" />,
    action: {
      label: 'Configure Settings',
      href: '/settings',
    },
  },
  {
    id: 'first-meeting',
    title: 'Schedule Your First Meeting',
    description: 'Add a meeting manually or wait for your next calendar event. zigznote will join automatically.',
    icon: <Video className="w-8 h-8" />,
    action: {
      label: 'Add Meeting',
      href: '/meetings',
    },
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'zigznote is ready to help. After your meetings, you\'ll find transcripts, summaries, and action items here.',
    icon: <Sparkles className="w-8 h-8" />,
  },
];

export function OnboardingWizard({
  onComplete,
  onSkip,
  initialStep = 0,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const router = useRouter();

  const steps = defaultSteps;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete?.();
    } else {
      setCompletedSteps((prev) => new Set([...prev, step.id]));
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete, step.id]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleAction = useCallback(() => {
    if (step.action?.onClick) {
      step.action.onClick();
    } else if (step.action?.href) {
      router.push(step.action.href);
    }
    setCompletedSteps((prev) => new Set([...prev, step.id]));
  }, [step, router]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg animate-scale-in">
        {/* Header with skip */}
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-slate-100">
          <div className="flex gap-0.5 sm:gap-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-6 sm:w-8 h-1 rounded-full transition-colors',
                  index === currentStep
                    ? 'bg-primary-500'
                    : index < currentStep
                      ? 'bg-primary-200'
                      : 'bg-slate-200'
                )}
              />
            ))}
          </div>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CardContent className="p-4 sm:p-8">
          {/* Icon */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-primary-600 mx-auto mb-4 sm:mb-6 [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-8 sm:[&>svg]:h-8">
            {step.icon}
          </div>

          {/* Content */}
          <div className="text-center mb-4 sm:mb-8">
            <h2 className="font-heading text-lg sm:text-2xl font-bold text-slate-900 mb-1.5 sm:mb-3">
              {step.title}
            </h2>
            <p className="text-xs sm:text-base text-slate-500 max-w-sm mx-auto">
              {step.description}
            </p>
          </div>

          {/* Action button */}
          {step.action && (
            <div className="mb-4 sm:mb-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAction}
              >
                {step.action.label}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isFirstStep}
              className={cn('flex-1 sm:flex-none', isFirstStep ? 'invisible' : '')}
            >
              Back
            </Button>

            <Button onClick={handleNext} className="flex-1 sm:flex-none">
              {isLastStep ? (
                <>
                  Get Started
                  <CheckCircle2 className="ml-2 w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>

        {/* Step indicator text */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 text-center text-xs sm:text-sm text-slate-400">
          Step {currentStep + 1} of {steps.length}
        </div>
      </Card>
    </div>
  );
}
