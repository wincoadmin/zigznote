/**
 * Animation Utilities
 * Shared animation variants and utilities for framer-motion
 */

import type { Variants, Transition } from 'framer-motion';

// ========================================
// Common Transitions
// ========================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: 'tween',
  duration: 0.3,
  ease: 'easeInOut',
};

export const bounceTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 20,
};

// ========================================
// Fade Animations
// ========================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: { opacity: 0, y: -20 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: { opacity: 0, y: 20 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: { opacity: 0, x: 20 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: { opacity: 0, x: -20 },
};

// ========================================
// Scale Animations
// ========================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
  exit: { opacity: 0, scale: 0.9 },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: bounceTransition,
  },
  exit: { opacity: 0, scale: 0.5 },
};

// ========================================
// Container Animations (for stagger)
// ========================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// ========================================
// List Item Animations
// ========================================

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: { opacity: 0, x: 10 },
};

export const gridItem: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
  exit: { opacity: 0, scale: 0.8 },
};

// ========================================
// Modal Animations
// ========================================

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
};

export const slideUp: Variants = {
  hidden: {
    opacity: 0,
    y: '100%',
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 30,
      stiffness: 400,
    },
  },
  exit: {
    opacity: 0,
    y: '100%',
  },
};

// ========================================
// Button/Interactive Animations
// ========================================

export const buttonTap = {
  scale: 0.97,
};

export const buttonHover = {
  scale: 1.02,
};

export const iconSpin: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
};

// ========================================
// Notification Animations
// ========================================

export const toastSlideIn: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: smoothTransition,
  },
};

// ========================================
// Page Transitions
// ========================================

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

// ========================================
// Utility Functions
// ========================================

/**
 * Creates a stagger delay based on index
 */
export function staggerDelay(index: number, baseDelay = 0.1): number {
  return index * baseDelay;
}

/**
 * Creates hover animation props for interactive elements
 */
export function hoverAnimation(scale = 1.02) {
  return {
    whileHover: { scale },
    whileTap: { scale: scale - 0.05 },
    transition: springTransition,
  };
}

/**
 * Creates entrance animation props
 */
export function entranceAnimation(delay = 0) {
  return {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    transition: { ...springTransition, delay },
  };
}
