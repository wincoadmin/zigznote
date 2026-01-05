export { useWebSocket } from './useWebSocket';
export type {
  BotStatusEvent,
  TranscriptChunkEvent,
  SummaryCompleteEvent,
  ActionItemsEvent,
  ErrorEvent,
  ConnectionState,
} from './useWebSocket';

export { useMeetingUpdates } from './useMeetingUpdates';
export { useDebounce } from './useDebounce';
export { useSmartPaste } from './useSmartPaste';
export { useFileDropZone } from './useFileDropZone';
export { useChatWithAttachments } from './useChatWithAttachments';

// Re-export MeetingStatus from types
export type { MeetingStatus } from '@/types';
