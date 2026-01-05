'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { audioApi } from '@/lib/api';

interface BrowserRecorderProps {
  onRecordingComplete?: (meetingId: string) => void;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'uploading';

export function BrowserRecorder({ onRecordingComplete }: BrowserRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');

      // Start duration timer
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError(
        'Could not access microphone. Please grant permission and try again.'
      );
      setState('idle');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    if (!title.trim()) {
      setError('Please enter a title for this recording');
      return;
    }

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop recording
    mediaRecorderRef.current.stop();

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setState('uploading');

    // Wait for final data
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create blob and upload
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    try {
      const response = await audioApi.uploadRecording(blob, title, duration);

      if (response.success && response.data) {
        onRecordingComplete?.(response.data.meetingId);
        // Reset
        setTitle('');
        setDuration(0);
        setState('idle');
      } else {
        throw new Error(response.error?.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recording');
      setState('idle');
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    chunksRef.current = [];
    setTitle('');
    setDuration(0);
    setState('idle');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
          Record In-Person Meeting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Meeting Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Team standup, Client meeting"
            disabled={state === 'uploading'}
          />
        </div>

        {/* Recording UI */}
        <div className="flex flex-col items-center py-6 space-y-4">
          {/* Duration display */}
          <div className="text-4xl font-mono font-bold text-slate-900">
            {formatDuration(duration)}
          </div>

          {/* Recording indicator */}
          {(state === 'recording' || state === 'paused') && (
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  state === 'recording'
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-slate-600">
                {state === 'recording' ? 'Recording...' : 'Paused'}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {state === 'idle' && (
              <Button onClick={startRecording} size="lg">
                <svg
                  className="h-5 w-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="6" />
                </svg>
                Start Recording
              </Button>
            )}

            {state === 'requesting' && (
              <Button disabled size="lg">
                Requesting microphone...
              </Button>
            )}

            {state === 'recording' && (
              <>
                <Button onClick={pauseRecording} variant="outline">
                  Pause
                </Button>
                <Button onClick={stopRecording} variant="destructive">
                  Stop & Save
                </Button>
              </>
            )}

            {state === 'paused' && (
              <>
                <Button onClick={resumeRecording}>Resume</Button>
                <Button onClick={stopRecording} variant="destructive">
                  Stop & Save
                </Button>
              </>
            )}

            {state === 'uploading' && (
              <Button disabled size="lg">
                Saving recording...
              </Button>
            )}

            {(state === 'recording' || state === 'paused') && (
              <Button onClick={cancelRecording} variant="ghost">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <p className="text-xs text-slate-400 text-center">
          Recording uses your browser&apos;s microphone. Works best in a quiet
          environment.
        </p>
      </CardContent>
    </Card>
  );
}
