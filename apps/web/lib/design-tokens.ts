/**
 * Design tokens for zigznote
 * Matches BRANDING.md specifications
 */

// Color palette
export const colors = {
  primary: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  secondary: {
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
  },
  accent: {
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
  },
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  meeting: {
    scheduled: '#64748B',
    recording: '#EF4444',
    processing: '#F59E0B',
    completed: '#10B981',
    failed: '#EF4444',
  },
} as const;

// Animation durations
export const durations = {
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;

// Easing functions
export const easings = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
} as const;

// Spacing scale (in pixels)
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// Border radius
export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

// Font sizes
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
} as const;

// Font weights
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// Breakpoints
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Meeting status configuration
export const meetingStatusConfig = {
  scheduled: {
    label: 'Scheduled',
    color: colors.meeting.scheduled,
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-600',
  },
  recording: {
    label: 'Recording',
    color: colors.meeting.recording,
    bgColor: 'bg-red-100',
    textColor: 'text-red-600',
  },
  processing: {
    label: 'Processing',
    color: colors.meeting.processing,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-600',
  },
  completed: {
    label: 'Completed',
    color: colors.meeting.completed,
    bgColor: 'bg-primary-100',
    textColor: 'text-primary-700',
  },
  failed: {
    label: 'Failed',
    color: colors.meeting.failed,
    bgColor: 'bg-red-100',
    textColor: 'text-red-600',
  },
} as const;

// Platform icons configuration
export const platformConfig = {
  zoom: {
    name: 'Zoom',
    color: '#2D8CFF',
  },
  meet: {
    name: 'Google Meet',
    color: '#00897B',
  },
  teams: {
    name: 'Microsoft Teams',
    color: '#6264A7',
  },
  webex: {
    name: 'Webex',
    color: '#00B6BA',
  },
} as const;

export type MeetingStatus = keyof typeof meetingStatusConfig;
export type Platform = keyof typeof platformConfig;
