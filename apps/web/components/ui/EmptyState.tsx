'use client';

/**
 * Enhanced Empty State Component
 * Shows contextual empty states with animations and CTAs
 */

import { motion } from 'framer-motion';
import { LucideIcon, Plus, Upload, Calendar, Search, FileAudio } from 'lucide-react';
import Link from 'next/link';

type EmptyStateType =
  | 'meetings'
  | 'transcripts'
  | 'action-items'
  | 'search'
  | 'custom';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: EmptyStateAction[];
  className?: string;
}

const EMPTY_STATE_CONFIGS: Record<
  Exclude<EmptyStateType, 'custom'>,
  { title: string; description: string; icon: LucideIcon; actions: EmptyStateAction[] }
> = {
  meetings: {
    title: 'No meetings yet',
    description:
      'Get started by recording your first meeting. Upload an audio file or record directly in your browser.',
    icon: FileAudio,
    actions: [
      {
        label: 'Upload Audio',
        href: '/upload',
        icon: Upload,
        variant: 'primary',
      },
      {
        label: 'Connect Calendar',
        href: '/settings/calendar',
        icon: Calendar,
        variant: 'secondary',
      },
    ],
  },
  transcripts: {
    title: 'No transcripts available',
    description:
      'Transcripts will appear here once your meetings are processed. Processing usually takes 2-5 minutes.',
    icon: FileAudio,
    actions: [
      {
        label: 'Record Meeting',
        href: '/record',
        icon: Plus,
        variant: 'primary',
      },
    ],
  },
  'action-items': {
    title: 'No action items yet',
    description:
      'Action items are automatically extracted from your meeting transcripts. Record a meeting to get started.',
    icon: Plus,
    actions: [
      {
        label: 'View Meetings',
        href: '/meetings',
        variant: 'secondary',
      },
    ],
  },
  search: {
    title: 'No results found',
    description:
      'Try adjusting your search terms or filters. We search across meeting titles, transcripts, and action items.',
    icon: Search,
    actions: [
      {
        label: 'Clear Search',
        variant: 'secondary',
      },
    ],
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 200,
    },
  },
};

export function EmptyState({
  type = 'custom',
  title,
  description,
  icon,
  actions,
  className = '',
}: EmptyStateProps) {
  const config = type !== 'custom' ? EMPTY_STATE_CONFIGS[type] : null;

  const displayTitle = title || config?.title || 'Nothing here yet';
  const displayDescription =
    description || config?.description || 'Get started by adding some content.';
  const DisplayIcon = icon || config?.icon || Plus;
  const displayActions = actions || config?.actions || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`flex flex-col items-center justify-center px-4 py-12 text-center ${className}`}
    >
      {/* Icon */}
      <motion.div
        variants={itemVariants}
        className="mb-6 rounded-full bg-gray-100 p-6 dark:bg-gray-800"
      >
        <DisplayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
      </motion.div>

      {/* Title */}
      <motion.h3
        variants={itemVariants}
        className="mb-2 text-xl font-semibold text-gray-900 dark:text-white"
      >
        {displayTitle}
      </motion.h3>

      {/* Description */}
      <motion.p
        variants={itemVariants}
        className="mb-8 max-w-md text-gray-600 dark:text-gray-400"
      >
        {displayDescription}
      </motion.p>

      {/* Actions */}
      {displayActions.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {displayActions.map((action, index) => {
            const ActionIcon = action.icon;
            const isPrimary = action.variant === 'primary';

            const buttonClasses = isPrimary
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600 hover:shadow-amber-500/40'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700';

            const content = (
              <>
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                {action.label}
              </>
            );

            if (action.href) {
              return (
                <Link
                  key={index}
                  href={action.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${buttonClasses}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={index}
                onClick={action.onClick}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${buttonClasses}`}
              >
                {content}
              </button>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}

export default EmptyState;
