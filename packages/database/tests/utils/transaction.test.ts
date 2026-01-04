/**
 * Tests for transaction utility functions
 * Note: These are unit tests that mock Prisma - integration tests would require a real database
 */

import { withTransaction, withRetryTransaction, batchTransaction } from '../../src/utils/transaction';
import { prisma } from '../../src/client';

// Mock the prisma client
jest.mock('../../src/client', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

describe('transaction utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withTransaction', () => {
    it('should execute callback within transaction', async () => {
      const mockResult = { id: 'test' };
      const callback = jest.fn().mockResolvedValue(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      const result = await withTransaction(callback);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('should pass transaction client to callback', async () => {
      const mockTx = { user: { create: jest.fn() } };
      const callback = jest.fn().mockResolvedValue({});

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb(mockTx));

      await withTransaction(callback);

      expect(callback).toHaveBeenCalledWith(mockTx);
    });

    it('should propagate errors from callback', async () => {
      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      await expect(withTransaction(callback)).rejects.toThrow('Transaction failed');
    });
  });

  describe('withRetryTransaction', () => {
    it('should succeed on first attempt', async () => {
      const mockResult = { id: 'test' };
      const callback = jest.fn().mockResolvedValue(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      const result = await withRetryTransaction(callback);

      expect(result).toBe(mockResult);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const mockResult = { id: 'test' };
      const callback = jest
        .fn()
        .mockRejectedValueOnce(new Error('deadlock detected'))
        .mockResolvedValueOnce(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      const result = await withRetryTransaction(callback, 3, 10);

      expect(result).toBe(mockResult);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('validation failed');
      const callback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      await expect(withRetryTransaction(callback, 3, 10)).rejects.toThrow(
        'validation failed'
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const error = new Error('deadlock detected');
      const callback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation((cb: Function) => cb({}));

      await expect(withRetryTransaction(callback, 2, 10)).rejects.toThrow(
        'deadlock detected'
      );
      expect(callback).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('batchTransaction', () => {
    it('should execute multiple operations in parallel', async () => {
      const op1 = jest.fn().mockResolvedValue({ id: '1' });
      const op2 = jest.fn().mockResolvedValue({ id: '2' });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
        const mockTx = {};
        return cb(mockTx);
      });

      const [result1, result2] = await batchTransaction([op1, op2]);

      expect(result1).toEqual({ id: '1' });
      expect(result2).toEqual({ id: '2' });
      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled();
    });

    it('should rollback all on any failure', async () => {
      const op1 = jest.fn().mockResolvedValue({ id: '1' });
      const op2 = jest.fn().mockRejectedValue(new Error('op2 failed'));

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
        const mockTx = {};
        return cb(mockTx);
      });

      await expect(batchTransaction([op1, op2])).rejects.toThrow('op2 failed');
    });
  });
});
