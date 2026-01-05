'use client';

/**
 * Command Palette Component (Cmd+K / Ctrl+K)
 * Quick navigation and actions across the app
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPanel, Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, Transition, TransitionChild } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Mic,
  Upload,
  Calendar,
  Settings,
  Users,
  FileAudio,
  Clock,
  Sparkles,
  Moon,
  Sun,
  LogOut,
  HelpCircle,
  Command,
  ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action?: () => void;
  href?: string;
  category: 'navigation' | 'actions' | 'settings' | 'recent';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  recentMeetings?: Array<{ id: string; title: string }>;
  onToggleTheme?: () => void;
  isDarkMode?: boolean;
}

const NAVIGATION_COMMANDS: CommandItem[] = [
  {
    id: 'nav-dashboard',
    name: 'Dashboard',
    description: 'Go to main dashboard',
    icon: <Sparkles className="h-5 w-5" />,
    href: '/dashboard',
    category: 'navigation',
  },
  {
    id: 'nav-meetings',
    name: 'Meetings',
    description: 'View all meetings',
    icon: <FileAudio className="h-5 w-5" />,
    href: '/meetings',
    category: 'navigation',
  },
  {
    id: 'nav-calendar',
    name: 'Calendar',
    description: 'Calendar integrations',
    icon: <Calendar className="h-5 w-5" />,
    href: '/settings/calendar',
    category: 'navigation',
  },
  {
    id: 'nav-team',
    name: 'Team',
    description: 'Manage team members',
    icon: <Users className="h-5 w-5" />,
    href: '/settings/team',
    category: 'navigation',
  },
  {
    id: 'nav-settings',
    name: 'Settings',
    description: 'Account settings',
    icon: <Settings className="h-5 w-5" />,
    href: '/settings',
    category: 'navigation',
  },
];

const ACTION_COMMANDS: CommandItem[] = [
  {
    id: 'action-record',
    name: 'Record Meeting',
    description: 'Start a new recording',
    icon: <Mic className="h-5 w-5 text-red-500" />,
    href: '/record',
    shortcut: 'R',
    category: 'actions',
  },
  {
    id: 'action-upload',
    name: 'Upload Audio',
    description: 'Upload audio file',
    icon: <Upload className="h-5 w-5 text-blue-500" />,
    href: '/upload',
    shortcut: 'U',
    category: 'actions',
  },
];

export function CommandPalette({
  isOpen,
  onClose,
  recentMeetings = [],
  onToggleTheme,
  isDarkMode = false,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Build command list with recent meetings and settings
  const commands = useMemo(() => {
    const items: CommandItem[] = [
      ...ACTION_COMMANDS,
      ...NAVIGATION_COMMANDS,
    ];

    // Add recent meetings
    recentMeetings.slice(0, 5).forEach((meeting) => {
      items.push({
        id: `recent-${meeting.id}`,
        name: meeting.title,
        description: 'Recent meeting',
        icon: <Clock className="h-5 w-5 text-gray-400" />,
        href: `/meetings/${meeting.id}`,
        category: 'recent',
      });
    });

    // Add settings commands
    items.push({
      id: 'settings-theme',
      name: isDarkMode ? 'Light Mode' : 'Dark Mode',
      description: `Switch to ${isDarkMode ? 'light' : 'dark'} theme`,
      icon: isDarkMode ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-indigo-500" />
      ),
      action: onToggleTheme,
      shortcut: 'T',
      category: 'settings',
    });

    items.push({
      id: 'settings-help',
      name: 'Help & Support',
      description: 'Get help with zigznote',
      icon: <HelpCircle className="h-5 w-5 text-green-500" />,
      href: '/help',
      shortcut: '?',
      category: 'settings',
    });

    return items;
  }, [recentMeetings, isDarkMode, onToggleTheme]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      actions: [],
      navigation: [],
      recent: [],
      settings: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Handle command selection
  const handleSelect = useCallback(
    (command: CommandItem | null) => {
      if (!command) return;

      onClose();

      if (command.action) {
        command.action();
      } else if (command.href) {
        router.push(command.href);
      }
    },
    [onClose, router]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // This would be handled by parent component
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset query when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const categoryLabels: Record<string, string> = {
    actions: 'Actions',
    navigation: 'Navigation',
    recent: 'Recent Meetings',
    settings: 'Settings',
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto p-4 pt-[20vh]">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
              <Combobox onChange={handleSelect}>
                {/* Search input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                  <ComboboxInput
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white sm:text-sm"
                    placeholder="Search commands..."
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="pointer-events-none absolute right-4 top-3 flex items-center gap-1">
                    <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      esc
                    </kbd>
                  </div>
                </div>

                {/* Results */}
                {filteredCommands.length > 0 && (
                  <ComboboxOptions
                    static
                    className="max-h-[400px] scroll-py-2 overflow-y-auto border-t border-gray-200 dark:border-gray-800"
                  >
                    {Object.entries(groupedCommands).map(
                      ([category, items]) =>
                        items.length > 0 && (
                          <div key={category}>
                            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                              {categoryLabels[category]}
                            </div>
                            {items.map((command) => (
                              <ComboboxOption
                                key={command.id}
                                value={command}
                                className={({ focus }) =>
                                  `flex cursor-pointer items-center gap-3 px-4 py-3 ${
                                    focus
                                      ? 'bg-amber-50 dark:bg-amber-900/20'
                                      : ''
                                  }`
                                }
                              >
                                {({ focus }) => (
                                  <>
                                    <div
                                      className={`flex-shrink-0 ${
                                        focus ? 'text-amber-600' : 'text-gray-400'
                                      }`}
                                    >
                                      {command.icon}
                                    </div>
                                    <div className="flex-1 truncate">
                                      <div
                                        className={`text-sm font-medium ${
                                          focus
                                            ? 'text-amber-900 dark:text-amber-100'
                                            : 'text-gray-900 dark:text-white'
                                        }`}
                                      >
                                        {command.name}
                                      </div>
                                      {command.description && (
                                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                          {command.description}
                                        </div>
                                      )}
                                    </div>
                                    {command.shortcut && (
                                      <kbd className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        {command.shortcut}
                                      </kbd>
                                    )}
                                    {focus && (
                                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-amber-500" />
                                    )}
                                  </>
                                )}
                              </ComboboxOption>
                            ))}
                          </div>
                        )
                    )}
                  </ComboboxOptions>
                )}

                {/* No results */}
                {query && filteredCommands.length === 0 && (
                  <div className="border-t border-gray-200 px-4 py-14 text-center dark:border-gray-800">
                    <Search className="mx-auto h-6 w-6 text-gray-400" />
                    <p className="mt-4 text-sm text-gray-900 dark:text-white">
                      No commands found
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Try a different search term
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 font-medium dark:bg-gray-700">
                        ↑↓
                      </kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 font-medium dark:bg-gray-700">
                        ↵
                      </kbd>
                      Select
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Command className="h-3 w-3" />K to open
                  </span>
                </div>
              </Combobox>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

export default CommandPalette;
