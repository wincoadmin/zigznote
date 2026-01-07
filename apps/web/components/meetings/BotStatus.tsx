'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Square, Loader2, CheckCircle, AlertCircle, Clock, Calendar, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface BotStatusProps {
  meetingId: string;
  initialStatus?: BotStatusType;
  scheduledTime?: string;
  onStatusChange?: (status: BotStatusType) => void;
}

export type BotStatusType =
  | 'none'
  | 'scheduled'
  | 'ready'
  | 'joining'
  | 'waiting_room'
  | 'in_call'
  | 'recording'
  | 'leaving'
  | 'ended'
  | 'error';

const STATUS_CONFIG: Record<
  BotStatusType,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
    showStop: boolean;
  }
> = {
  none: {
    label: 'No bot',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    icon: null,
    showStop: false,
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: <Calendar className="w-4 h-4" />,
    showStop: true,
  },
  ready: {
    label: 'Ready to join',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: <Clock className="w-4 h-4" />,
    showStop: true,
  },
  joining: {
    label: 'Joining meeting...',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    showStop: true,
  },
  waiting_room: {
    label: 'In waiting room',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: <Clock className="w-4 h-4" />,
    showStop: true,
  },
  in_call: {
    label: 'In meeting',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: <Video className="w-4 h-4" />,
    showStop: true,
  },
  recording: {
    label: 'Recording',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />,
    showStop: true,
  },
  leaving: {
    label: 'Leaving meeting...',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    showStop: false,
  },
  ended: {
    label: 'Recording complete',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: <CheckCircle className="w-4 h-4" />,
    showStop: false,
  },
  error: {
    label: 'Error',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: <AlertCircle className="w-4 h-4" />,
    showStop: false,
  },
};

export function BotStatus({
  meetingId,
  initialStatus = 'none',
  scheduledTime,
  onStatusChange,
}: BotStatusProps) {
  const [status, setStatus] = useState<BotStatusType>(initialStatus);
  const [joinAt, setJoinAt] = useState<string | null>(scheduledTime || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle bot status changes from WebSocket
  const handleBotStatus = useCallback(
    (event: { meetingId: string; status: string }) => {
      if (event.meetingId === meetingId) {
        const newStatus = event.status as BotStatusType;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    },
    [meetingId, onStatusChange]
  );

  // Listen for real-time updates
  useWebSocket({
    meetingId,
    onBotStatus: handleBotStatus,
  });

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/bot`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.status) {
            setStatus(data.data.status as BotStatusType);
          }
          if (data.data?.joinAt) {
            setJoinAt(data.data.joinAt);
          }
        }
      } catch (err) {
        console.error('Failed to fetch bot status:', err);
      }
    };

    fetchStatus();
  }, [meetingId]);

  const handleStopBot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/bot`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to stop bot');
      }

      setStatus('leaving');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    } finally {
      setIsLoading(false);
    }
  };

  const config = STATUS_CONFIG[status];

  if (status === 'none') {
    return null;
  }

  // Format scheduled time
  const formattedScheduledTime = joinAt
    ? new Date(joinAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${config.bgColor}`}>
      <div className={`flex items-center gap-2 ${config.color}`}>
        {config.icon}
        <span className="text-sm font-medium">
          {status === 'scheduled' && formattedScheduledTime
            ? `Scheduled for ${formattedScheduledTime}`
            : config.label}
        </span>
      </div>

      {config.showStop && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStopBot}
          disabled={isLoading}
          className="ml-auto"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {status === 'scheduled' ? (
                <XCircle className="w-4 h-4 mr-1" />
              ) : (
                <Square className="w-4 h-4 mr-1" />
              )}
              {status === 'scheduled' ? 'Cancel' : 'Stop'}
            </>
          )}
        </Button>
      )}

      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </div>
  );
}
