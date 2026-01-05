'use client';

/**
 * Celebration Modal with Confetti
 * Shows achievement unlocks and milestones
 */

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import confetti from 'canvas-confetti';
import { Trophy, Star, Sparkles, X, Share2 } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'achievement' | 'milestone' | 'streak';
  title: string;
  description: string;
  icon?: string;
  points?: number;
  onShare?: () => void;
}

const confettiColors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6'];

export function CelebrationModal({
  isOpen,
  onClose,
  type = 'achievement',
  title,
  description,
  icon,
  points,
  onShare,
}: CelebrationModalProps) {
  // Fire confetti when modal opens
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti from both sides
      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
        colors: confettiColors,
        disableForReducedMotion: true,
      });

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
        colors: confettiColors,
        disableForReducedMotion: true,
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const cleanup = fireConfetti();
      return cleanup;
    }
  }, [isOpen, fireConfetti]);

  const getTypeIcon = () => {
    switch (type) {
      case 'milestone':
        return <Star className="h-8 w-8 text-yellow-500" />;
      case 'streak':
        return <Sparkles className="h-8 w-8 text-purple-500" />;
      default:
        return <Trophy className="h-8 w-8 text-amber-500" />;
    }
  };

  const getBgGradient = () => {
    switch (type) {
      case 'milestone':
        return 'from-yellow-400 to-orange-500';
      case 'streak':
        return 'from-purple-400 to-pink-500';
      default:
        return 'from-amber-400 to-orange-500';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="relative w-full max-w-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
              >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-1 text-white transition-colors hover:bg-white/30"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Gradient header */}
              <div
                className={`relative bg-gradient-to-br ${getBgGradient()} px-8 pb-16 pt-12`}
              >
                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10"
                  />
                  <motion.div
                    animate={{
                      rotate: [360, 0],
                    }}
                    transition={{
                      duration: 15,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="absolute -bottom-20 -right-10 h-60 w-60 rounded-full bg-white/10"
                  />
                </div>

                {/* Icon badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                  className="relative mx-auto flex h-24 w-24 items-center justify-center"
                >
                  {/* Outer glow ring */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.2, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                    className="absolute inset-0 rounded-full bg-white/30"
                  />
                  {/* Inner badge */}
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
                    {icon ? (
                      <span className="text-4xl">{icon}</span>
                    ) : (
                      getTypeIcon()
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Content */}
              <div className="relative -mt-8 rounded-t-3xl bg-white px-8 pb-8 pt-6 dark:bg-gray-900">
                {/* Points badge */}
                {points && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2"
                  >
                    <div className="rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-700 shadow-md dark:bg-amber-900/40 dark:text-amber-300">
                      +{points} points
                    </div>
                  </motion.div>
                )}

                <DialogTitle className="mt-4 text-center text-2xl font-bold text-gray-900 dark:text-white">
                  {title}
                </DialogTitle>

                <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
                  {description}
                </p>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  {onShare && (
                    <button
                      onClick={onShare}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 hover:shadow-amber-500/40"
                  >
                    Awesome!
                  </button>
                </div>
              </div>
              </motion.div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

export default CelebrationModal;
