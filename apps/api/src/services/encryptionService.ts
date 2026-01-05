/**
 * Encryption service
 * AES-256-CBC encryption for sensitive data storage
 */

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

class EncryptionService {
  private key: Buffer;

  constructor() {
    this.key = this.deriveKey();
  }

  /**
   * Derive a 256-bit key from the configured secret
   */
  private deriveKey(): Buffer {
    const secret = config.encryption?.key || config.encryptionKey || 'default-key-change-me';
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encrypt a string
   * Returns: iv:encryptedData (hex encoded)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string
   * Input format: iv:encryptedData (hex encoded)
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, encryptedData] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate a secure random string (for API keys, secrets, etc.)
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a value (one-way, for comparison)
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Get the last N characters of a string (for hints)
   */
  getHint(value: string, chars = 4): string {
    return value.slice(-chars);
  }

  /**
   * Mask a string, showing only first and last few characters
   */
  mask(value: string, showFirst = 4, showLast = 4): string {
    if (value.length <= showFirst + showLast) {
      return '*'.repeat(value.length);
    }
    const first = value.slice(0, showFirst);
    const last = value.slice(-showLast);
    const middle = '*'.repeat(Math.min(value.length - showFirst - showLast, 20));
    return `${first}${middle}${last}`;
  }
}

export const encryptionService = new EncryptionService();
