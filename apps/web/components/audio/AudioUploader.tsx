'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { audioApi } from '@/lib/api';

interface AudioUploaderProps {
  onUploadComplete?: (meetingId: string) => void;
}

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/mp4': ['.m4a'],
  'audio/x-m4a': ['.m4a'],
  'audio/ogg': ['.ogg'],
  'audio/aac': ['.aac'],
};

export function AudioUploader({ onUploadComplete }: AudioUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const audioFile = acceptedFiles[0];
    if (audioFile) {
      setFile(audioFile);
      setTitle(audioFile.name.replace(/\.[^.]+$/, '')); // Remove extension
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const handleUpload = async () => {
    if (!file || !title) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL
      const urlResponse = await audioApi.getUploadUrl(
        file.name,
        file.type,
        file.size
      );

      if (!urlResponse.success || !urlResponse.data) {
        throw new Error(urlResponse.error?.message || 'Failed to get upload URL');
      }

      setProgress(10);

      // Step 2: Upload to S3
      const { uploadUrl, fileUrl } = urlResponse.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = 10 + (e.loaded / e.total) * 70; // 10-80%
            setProgress(Math.round(percent));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setProgress(85);

      // Step 3: Finalize upload
      const finalizeResponse = await audioApi.finalizeUpload({
        title,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
      });

      if (!finalizeResponse.success || !finalizeResponse.data) {
        throw new Error(finalizeResponse.error?.message || 'Failed to process upload');
      }

      setProgress(100);

      // Success!
      onUploadComplete?.(finalizeResponse.data.meetingId);

      // Reset form
      setFile(null);
      setTitle('');
      setProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-3 sm:p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}
            ${file ? 'border-green-500 bg-green-50' : ''}
          `}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="space-y-1.5 sm:space-y-2">
              <svg
                className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-xs sm:text-sm font-medium text-slate-900 truncate px-2">{file.name}</p>
              <p className="text-[10px] sm:text-xs text-slate-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              <svg
                className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-xs sm:text-sm text-slate-600">
                {isDragActive
                  ? 'Drop the audio file here'
                  : 'Drag & drop an audio file, or tap to select'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400">
                MP3, WAV, M4A, WebM, OGG, AAC (up to 500MB)
              </p>
            </div>
          )}
        </div>

        {file && (
          <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Meeting Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this recording"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5 sm:space-y-2">
                <Progress value={progress} />
                <p className="text-[10px] sm:text-xs text-slate-500 text-center">
                  {progress < 10
                    ? 'Preparing...'
                    : progress < 80
                      ? 'Uploading...'
                      : progress < 100
                        ? 'Processing...'
                        : 'Complete!'}
                </p>
              </div>
            )}

            {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setTitle('');
                  setError(null);
                }}
                disabled={uploading}
              >
                Clear
              </Button>
              <Button onClick={handleUpload} disabled={!title || uploading}>
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
