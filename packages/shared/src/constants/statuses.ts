/**
 * Centralized status constants
 * Import these instead of using string literals
 */

export const MeetingStatus = {
  SCHEDULED: 'scheduled',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type MeetingStatusType = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const BotStatus = {
  PENDING: 'pending',
  JOINING: 'joining',
  JOINED: 'joined',
  RECORDING: 'recording',
  LEAVING: 'leaving',
  LEFT: 'left',
  ERROR: 'error',
} as const;

export type BotStatusType = (typeof BotStatus)[keyof typeof BotStatus];

export const TranscriptStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TranscriptStatusType = (typeof TranscriptStatus)[keyof typeof TranscriptStatus];

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type InvitationStatusType = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const SubscriptionStatus = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  UNPAID: 'unpaid',
} as const;

export type SubscriptionStatusType = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];
