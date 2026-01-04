/**
 * Encryption utilities for secure token storage
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derives a key from the encryption key and salt
 */
function deriveKey(key: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts a string value
 * @param value - Value to encrypt
 * @param encryptionKey - Encryption key
 * @returns Encrypted string (base64 encoded)
 */
export function encrypt(value: string, encryptionKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine salt + iv + tag + encrypted data
  const result = Buffer.concat([salt, iv, tag, encrypted]);

  return result.toString('base64');
}

/**
 * Decrypts an encrypted string value
 * @param encryptedValue - Encrypted value (base64 encoded)
 * @param encryptionKey - Encryption key
 * @returns Decrypted string
 */
export function decrypt(encryptedValue: string, encryptionKey: string): string {
  const data = Buffer.from(encryptedValue, 'base64');

  // Extract components
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(encryptionKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a random encryption key
 * @returns 32-character hex string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
