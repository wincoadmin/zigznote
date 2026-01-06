'use client';

/**
 * Welcome Modal - Onboarding flow for new users
 * Multi-step wizard with animations
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  Mic,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userName?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to zigznote!',
    description:
      'Your meetings, simplified. Let us show you around and help you get the most out of your meeting assistant.',
    icon: <Sparkles className="h-12 w-12 text-amber-500" />,
  },
  {
    id: 'record',
    title: 'Record Your Meetings',
    description:
      'Upload audio files, record directly in your browser, or let our bots automatically join your video calls.',
    icon: <Mic className="h-12 w-12 text-blue-500" />,
  },
  {
    id: 'calendar',
    title: 'Connect Your Calendar',
    description:
      'Link your Google Calendar to automatically detect upcoming meetings and join them hands-free.',
    icon: <CalendarDays className="h-12 w-12 text-green-500" />,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description:
      'Start by recording your first meeting. We\'ll handle the transcription, summaries, and action items.',
    icon: <CheckCircle2 className="h-12 w-12 text-emerald-500" />,
  },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function WelcomeModal({
  isOpen,
  onClose,
  onComplete,
  userName,
}: WelcomeModalProps) {
  const [[currentStep, direction], setStep] = useState([0, 0]);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setStep([currentStep + 1, 1]);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setStep([currentStep - 1, -1]);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  // Personalize welcome message
  const title =
    step.id === 'welcome' && userName
      ? `Welcome to zigznote, ${userName}!`
      : step.title;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4">
        <DialogPanel className="relative w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="rounded-xl sm:rounded-2xl bg-white p-4 sm:p-8 shadow-2xl dark:bg-gray-900"
          >
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Step content */}
          <div className="relative min-h-[220px] sm:min-h-[280px] overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={step.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                className="flex flex-col items-center text-center"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="mb-4 sm:mb-6 rounded-full bg-gray-50 p-4 sm:p-6 dark:bg-gray-800 [&>svg]:h-8 [&>svg]:w-8 sm:[&>svg]:h-12 sm:[&>svg]:w-12"
                >
                  {step.icon}
                </motion.div>

                {/* Title */}
                <DialogTitle className="mb-1.5 sm:mb-3 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {title}
                </DialogTitle>

                {/* Description */}
                <p className="mb-4 sm:mb-8 text-xs sm:text-base max-w-sm text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>

                {/* Optional action button */}
                {step.action && (
                  <button
                    onClick={step.action.onClick}
                    className="mb-3 sm:mb-4 rounded-lg bg-amber-100 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    {step.action.label}
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="mb-4 sm:mb-6 flex justify-center gap-1.5 sm:gap-2">
            {ONBOARDING_STEPS.map((s, index) => (
              <motion.button
                key={s.id}
                onClick={() => setStep([index, index > currentStep ? 1 : -1])}
                className={`h-1.5 sm:h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-4 sm:w-6 bg-amber-500'
                    : 'w-1.5 sm:w-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700'
                }`}
                whileHover={{ scale: 1.2 }}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className={`flex items-center gap-1 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                isFirstStep
                  ? 'invisible'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back
            </button>

            <button
              onClick={handleSkip}
              className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Skip
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 hover:shadow-amber-500/40"
            >
              {isLastStep ? (
                "Let's Go!"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </>
              )}
            </button>
          </div>
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default WelcomeModal;
