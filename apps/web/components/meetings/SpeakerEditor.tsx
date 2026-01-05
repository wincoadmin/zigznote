'use client';

import { useState, useCallback } from 'react';
import { voiceProfilesApi, speakersApi, type SpeakerIdentification } from '@/lib/api';

interface SpeakerEditorProps {
  meetingId: string;
  speakers: SpeakerIdentification[];
  onSpeakersChange?: () => void;
}

/**
 * Component for editing speaker identifications in a meeting
 * Allows confirming, rejecting, and manually correcting speaker names
 */
export function SpeakerEditor({ meetingId, speakers, onSpeakersChange }: SpeakerEditorProps) {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateSpeaker = useCallback(async (speakerLabel: string, displayName: string) => {
    if (!displayName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await speakersApi.upsert({
        speakerLabel,
        displayName: displayName.trim(),
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update speaker');
      }

      setEditingSpeaker(null);
      onSpeakersChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update speaker');
    } finally {
      setIsLoading(false);
    }
  }, [onSpeakersChange]);

  const handleConfirmSpeaker = useCallback(async (speakerLabel: string, confirmed: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await voiceProfilesApi.confirmSpeaker(meetingId, speakerLabel, confirmed);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to confirm speaker');
      }

      onSpeakersChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm speaker');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, onSpeakersChange]);

  const handleReprocess = useCallback(async () => {
    setIsReprocessing(true);
    setError(null);

    try {
      const response = await voiceProfilesApi.reprocessMeeting(meetingId);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to reprocess speakers');
      }

      onSpeakersChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess speakers');
    } finally {
      setIsReprocessing(false);
    }
  }, [meetingId, onSpeakersChange]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'introduction':
        return 'Detected from introduction';
      case 'voice_match':
        return 'Matched by voice';
      case 'calendar':
        return 'From calendar';
      case 'manual':
        return 'Manually set';
      default:
        return method;
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-slate-900">Speakers</h3>
        <button
          type="button"
          onClick={handleReprocess}
          disabled={isReprocessing}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {isReprocessing ? 'Processing...' : 'Re-detect Names'}
        </button>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {speakers.map((speaker) => (
          <div
            key={speaker.speakerLabel}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex-1">
              {editingSpeaker === speaker.speakerLabel ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter name"
                    className="w-48 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateSpeaker(speaker.speakerLabel, editName);
                      } else if (e.key === 'Escape') {
                        setEditingSpeaker(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateSpeaker(speaker.speakerLabel, editName)}
                    disabled={isLoading || !editName.trim()}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSpeaker(null)}
                    className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{speaker.displayName}</span>
                    <span className="text-xs text-slate-400">({speaker.speakerLabel})</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {getMethodLabel(speaker.matchMethod)}
                    </span>
                    <span className={`text-xs ${getConfidenceColor(speaker.confidence)}`}>
                      {Math.round(speaker.confidence * 100)}% confident
                    </span>
                  </div>
                </div>
              )}
            </div>

            {editingSpeaker !== speaker.speakerLabel && (
              <div className="flex items-center gap-1">
                {speaker.matchMethod === 'introduction' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConfirmSpeaker(speaker.speakerLabel, true)}
                      disabled={isLoading}
                      className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                      title="Confirm this is correct"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmSpeaker(speaker.speakerLabel, false)}
                      disabled={isLoading}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      title="This is incorrect"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingSpeaker(speaker.speakerLabel);
                    setEditName(speaker.displayName);
                  }}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                  title="Edit name"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}

        {speakers.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No speakers identified yet. Names will be detected from introductions.
          </p>
        )}
      </div>
    </div>
  );
}
