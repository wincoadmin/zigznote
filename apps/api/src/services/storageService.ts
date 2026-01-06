/**
 * @ownership
 * @domain File Storage
 * @description Handles audio file uploads to S3-compatible storage
 * @single-responsibility YES — all file storage operations
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { BadRequestError } from '@zigznote/shared';

// Buckets for different content types
const BUCKETS = {
  AUDIO: 'zigznote-audio',
  EXPORTS: 'zigznote-exports',
  AVATARS: 'zigznote-avatars',
  BACKUPS: 'zigznote-backups',
} as const;

export type BucketType = keyof typeof BUCKETS;

// Supported audio formats
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',       // mp3
  'audio/mp3',        // mp3 alternate
  'audio/wav',        // wav
  'audio/wave',       // wav alternate
  'audio/x-wav',      // wav alternate
  'audio/webm',       // webm (browser recording)
  'audio/ogg',        // ogg
  'audio/mp4',        // m4a
  'audio/x-m4a',      // m4a alternate
  'audio/aac',        // aac
  'video/webm',       // webm with video (we extract audio)
] as const;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const UPLOAD_EXPIRY = 60 * 60; // 1 hour for presigned URLs

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  key: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresAt: Date;
}

class StorageService {
  private client: S3Client | null = null;
  private bucket: string;

  constructor() {
    this.bucket = config.aws?.bucket || 'zigznote-audio';

    // Only initialize S3 client if credentials are configured
    if (config.aws?.accessKeyId && config.aws?.secretAccessKey) {
      this.client = new S3Client({
        region: config.aws?.region || 'us-east-1',
        endpoint: config.aws?.endpoint, // For S3-compatible services like MinIO, R2
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
        forcePathStyle: !!config.aws?.endpoint, // Required for MinIO/R2
      });
    }
  }

  /**
   * Check if storage is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Initialize all required buckets
   * Should be called on application startup
   */
  async initializeBuckets(): Promise<void> {
    if (!this.client) {
      console.log('Storage not configured, skipping bucket initialization');
      return;
    }

    console.log('Initializing storage buckets...');

    for (const [, bucket] of Object.entries(BUCKETS)) {
      try {
        // Check if bucket exists
        await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
        console.log(`  ✓ Bucket ${bucket} exists`);
      } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
          // Create bucket if it doesn't exist
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
            console.log(`  ✓ Created bucket ${bucket}`);
          } catch (createError) {
            console.error(`  ✗ Failed to create bucket ${bucket}:`, createError);
          }
        } else {
          console.error(`  ✗ Error checking bucket ${bucket}:`, error);
        }
      }
    }

    console.log('Storage bucket initialization complete');
  }

  /**
   * Get bucket name by type
   */
  getBucket(type: BucketType = 'AUDIO'): string {
    return BUCKETS[type];
  }

  /**
   * List files in a bucket with optional prefix
   */
  async listFiles(
    prefix?: string,
    bucketType: BucketType = 'AUDIO',
    maxKeys = 1000
  ): Promise<{ key: string; size: number; lastModified: Date }[]> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    const bucket = this.getBucket(bucketType);
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })
    );

    return (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  }

  /**
   * Validate file before upload
   */
  validateFile(mimeType: string, fileSize: number): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
      throw new BadRequestError(
        `Unsupported file type: ${mimeType}. Supported: mp3, wav, m4a, webm, ogg, aac`
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `File too large: ${Math.round(fileSize / 1024 / 1024)}MB. Maximum: 500MB`
      );
    }
  }

  /**
   * Generate a presigned URL for direct browser upload
   * This allows uploading directly to S3 without going through our server
   */
  async getPresignedUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<PresignedUploadResult> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    this.validateFile(mimeType, fileSize);

    const fileId = randomUUID();
    const extension = this.getExtension(fileName, mimeType);
    const key = `audio/${organizationId}/${fileId}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_EXPIRY,
    });

    const fileUrl = this.getPublicUrl(key);
    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY * 1000);

    return { uploadUrl, fileUrl, key, expiresAt };
  }

  /**
   * Upload file directly (for server-side uploads)
   */
  async uploadFile(
    organizationId: string,
    fileName: string,
    mimeType: string,
    body: Buffer | Uint8Array
  ): Promise<UploadResult> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    this.validateFile(mimeType, body.length);

    const fileId = randomUUID();
    const extension = this.getExtension(fileName, mimeType);
    const key = `audio/${organizationId}/${fileId}${extension}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }));

    return {
      fileUrl: this.getPublicUrl(key),
      fileName,
      fileSize: body.length,
      mimeType,
      key,
    };
  }

  /**
   * Get a presigned URL for downloading/streaming
   */
  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  /**
   * Upload a buffer with a specific key (for backups and other internal uploads)
   */
  async uploadFileBuffer(
    prefix: string,
    fileName: string,
    mimeType: string,
    body: Buffer
  ): Promise<string> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    const key = `${prefix}/${fileName}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }));

    return key;
  }

  /**
   * Get a readable stream for a file (for backups)
   */
  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    if (!this.client) {
      throw new BadRequestError('Storage is not configured');
    }

    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));

    if (!response.Body) {
      throw new Error('File not found');
    }

    return response.Body as NodeJS.ReadableStream;
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (config.aws?.cdnUrl) {
      return `${config.aws.cdnUrl}/${key}`;
    }
    if (config.aws?.endpoint) {
      return `${config.aws.endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Get file extension from filename or mime type
   */
  private getExtension(fileName: string, mimeType: string): string {
    // Try to get from filename first
    const match = fileName.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0].toLowerCase();

    // Fall back to mime type
    const mimeExtensions: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
      'audio/aac': '.aac',
      'video/webm': '.webm',
    };

    return mimeExtensions[mimeType] || '.audio';
  }
}

export const storageService = new StorageService();
