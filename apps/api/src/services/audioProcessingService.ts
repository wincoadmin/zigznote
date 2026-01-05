/**
 * @ownership
 * @domain Audio Processing
 * @description Handles audio file processing for uploaded and recorded audio
 * @single-responsibility YES — audio processing pipeline for non-bot sources
 */

import { meetingRepository } from '@zigznote/database';
import { storageService } from './storageService';
import { queueTranscriptionJob } from '../jobs/queues';
import { logger } from '../utils/logger';

export interface CreateFromUploadInput {
  organizationId: string;
  userId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  audioDuration?: number;
}

export interface CreateFromRecordingInput {
  organizationId: string;
  userId: string;
  title: string;
  audioBlob: Buffer;
  mimeType: string;
  duration: number;
}

class AudioProcessingService {
  /**
   * Create a meeting from an uploaded audio file
   */
  async createFromUpload(input: CreateFromUploadInput): Promise<{ meetingId: string }> {
    // Create meeting record
    const meeting = await meetingRepository.create({
      organizationId: input.organizationId,
      createdById: input.userId,
      title: input.title,
      source: 'upload',
      status: 'processing',
      audioFileUrl: input.fileUrl,
      audioFileName: input.fileName,
      audioFileSize: input.fileSize,
      audioDuration: input.audioDuration,
    });

    logger.info({ meetingId: meeting.id, fileName: input.fileName }, 'Created meeting from upload');

    // Queue for transcription
    await queueTranscriptionJob({
      meetingId: meeting.id,
      audioUrl: input.fileUrl,
      organizationId: input.organizationId,
      source: 'upload',
    });

    return { meetingId: meeting.id };
  }

  /**
   * Create a meeting from browser-recorded audio
   */
  async createFromRecording(input: CreateFromRecordingInput): Promise<{ meetingId: string }> {
    // Upload to storage
    const fileName = `recording-${Date.now()}.webm`;
    const upload = await storageService.uploadFile(
      input.organizationId,
      fileName,
      input.mimeType,
      input.audioBlob
    );

    // Create meeting record
    const meeting = await meetingRepository.create({
      organizationId: input.organizationId,
      createdById: input.userId,
      title: input.title,
      source: 'browser',
      status: 'processing',
      audioFileUrl: upload.fileUrl,
      audioFileName: fileName,
      audioFileSize: upload.fileSize,
      audioDuration: input.duration,
    });

    logger.info({ meetingId: meeting.id, duration: input.duration }, 'Created meeting from browser recording');

    // Queue for transcription
    await queueTranscriptionJob({
      meetingId: meeting.id,
      audioUrl: upload.fileUrl,
      organizationId: input.organizationId,
      source: 'browser',
    });

    return { meetingId: meeting.id };
  }

  /**
   * Get presigned upload URL for direct browser upload
   */
  async getUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
  ) {
    return storageService.getPresignedUploadUrl(
      organizationId,
      fileName,
      mimeType,
      fileSize
    );
  }

  /**
   * Finalize an upload after file is uploaded to S3
   */
  async finalizeUpload(
    organizationId: string,
    userId: string,
    title: string,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    audioDuration?: number
  ): Promise<{ meetingId: string }> {
    return this.createFromUpload({
      organizationId,
      userId,
      title,
      fileUrl,
      fileName,
      fileSize,
      audioDuration,
    });
  }
}

export const audioProcessingService = new AudioProcessingService();
