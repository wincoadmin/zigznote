/**
 * Database transaction utilities
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { TransactionCallback } from '../types';

/**
 * Executes a callback within a database transaction
 * Automatically rolls back on error
 *
 * @param callback - Function to execute within the transaction
 * @returns Result of the callback
 * @throws Re-throws any error from the callback after rollback
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: { email: 'test@example.com', organizationId: orgId } });
 *   const meeting = await tx.meeting.create({ data: { title: 'Test', organizationId: orgId, createdById: user.id } });
 *   return { user, meeting };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  return prisma.$transaction(callback, {
    maxWait: 5000, // 5 seconds to acquire a connection
    timeout: 10000, // 10 seconds for the transaction
  });
}

/**
 * Executes multiple operations in a transaction with automatic retry on conflict
 * Useful for handling optimistic locking scenarios
 *
 * @param callback - Function to execute within the transaction
 * @param maxRetries - Maximum number of retries on conflict (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 100)
 * @returns Result of the callback
 * @throws Error after all retries are exhausted
 */
export async function withRetryTransaction<T>(
  callback: TransactionCallback<T>,
  maxRetries = 3,
  retryDelay = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error) {
      lastError = error as Error;

      // Check if this is a serialization or deadlock error that should be retried
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('deadlock') ||
          error.message.includes('could not serialize') ||
          error.message.includes('concurrent update'));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = retryDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Transaction failed after retries');
}

/**
 * Executes multiple independent operations in parallel within a transaction
 * All operations succeed or all fail together
 *
 * @param operations - Array of operations to execute
 * @returns Array of results from all operations
 *
 * @example
 * ```typescript
 * const [user1, user2] = await batchTransaction([
 *   (tx) => tx.user.create({ data: { email: 'user1@test.com', organizationId: orgId } }),
 *   (tx) => tx.user.create({ data: { email: 'user2@test.com', organizationId: orgId } }),
 * ]);
 * ```
 */
export async function batchTransaction<T extends unknown[]>(
  operations: { [K in keyof T]: TransactionCallback<T[K]> }
): Promise<T> {
  return withTransaction(async (tx) => {
    const results = await Promise.all(
      operations.map((operation) => operation(tx))
    );
    return results as T;
  });
}

/**
 * Helper to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a savepoint within a transaction for partial rollback
 * Note: Prisma doesn't natively support savepoints, this is a helper for raw queries
 *
 * @param tx - Transaction client
 * @param name - Savepoint name
 */
export async function createSavepoint(
  tx: Prisma.TransactionClient,
  name: string
): Promise<void> {
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
}

/**
 * Rolls back to a savepoint within a transaction
 *
 * @param tx - Transaction client
 * @param name - Savepoint name to roll back to
 */
export async function rollbackToSavepoint(
  tx: Prisma.TransactionClient,
  name: string
): Promise<void> {
  await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
}

/**
 * Releases a savepoint within a transaction
 *
 * @param tx - Transaction client
 * @param name - Savepoint name to release
 */
export async function releaseSavepoint(
  tx: Prisma.TransactionClient,
  name: string
): Promise<void> {
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
}
