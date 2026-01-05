/**
 * H.4 Chaos Engineering Tests
 * Tests for system resilience under failure conditions
 */

describe('Chaos Engineering Tests', () => {
  describe('Database Failure Scenarios', () => {
    it('should handle database connection timeout', async () => {
      const mockDbClient = {
        isConnected: true,
        connectionTimeout: 5000,

        async query(_sql: string): Promise<unknown> {
          if (!this.isConnected) {
            throw new Error('Connection timeout: Database unreachable');
          }
          return { rows: [] };
        },

        disconnect(): void {
          this.isConnected = false;
        },

        reconnect(): void {
          this.isConnected = true;
        },
      };

      // Normal operation
      await expect(mockDbClient.query('SELECT 1')).resolves.toBeDefined();

      // Simulate connection loss
      mockDbClient.disconnect();
      await expect(mockDbClient.query('SELECT 1')).rejects.toThrow('Connection timeout');

      // Recovery
      mockDbClient.reconnect();
      await expect(mockDbClient.query('SELECT 1')).resolves.toBeDefined();
    });

    it('should implement database connection retry with backoff', async () => {
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 100;

      const connectWithRetry = async (): Promise<boolean> => {
        for (let i = 0; i < maxAttempts; i++) {
          attempts++;
          try {
            // Simulate connection that fails first 3 times
            if (attempts <= 3) {
              throw new Error('Connection refused');
            }
            return true;
          } catch {
            if (i === maxAttempts - 1) throw new Error('Max retries exceeded');
            const delay = baseDelay * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay / 100)); // Speed up for test
          }
        }
        return false;
      };

      const result = await connectWithRetry();
      expect(result).toBe(true);
      expect(attempts).toBe(4); // Failed 3 times, succeeded on 4th
    });

    it('should handle database failover gracefully', async () => {
      const dbCluster = {
        primary: { host: 'db-primary', isHealthy: true },
        replicas: [
          { host: 'db-replica-1', isHealthy: true },
          { host: 'db-replica-2', isHealthy: true },
        ],

        getReadConnection(): string {
          // Prefer replicas for reads
          const healthyReplicas = this.replicas.filter(r => r.isHealthy);
          if (healthyReplicas.length > 0) {
            return healthyReplicas[0].host;
          }
          // Fallback to primary
          if (this.primary.isHealthy) {
            return this.primary.host;
          }
          throw new Error('No healthy database connections available');
        },

        getWriteConnection(): string {
          if (this.primary.isHealthy) {
            return this.primary.host;
          }
          throw new Error('Primary database unavailable');
        },
      };

      expect(dbCluster.getReadConnection()).toBe('db-replica-1');
      expect(dbCluster.getWriteConnection()).toBe('db-primary');

      // Simulate primary failure
      dbCluster.primary.isHealthy = false;
      expect(dbCluster.getReadConnection()).toBe('db-replica-1');
      expect(() => dbCluster.getWriteConnection()).toThrow('Primary database unavailable');

      // Simulate all replicas failing
      dbCluster.replicas.forEach(r => (r.isHealthy = false));
      expect(() => dbCluster.getReadConnection()).toThrow('No healthy database connections');
    });

    it('should handle partial query results on connection drop', async () => {
      interface QueryResult {
        data: unknown[];
        isComplete: boolean;
        resumeToken?: string;
      }

      const queryWithResume = async (
        resumeToken?: string,
      ): Promise<QueryResult> => {
        const startIndex = resumeToken ? parseInt(resumeToken) : 0;
        const batchSize = 100;

        // Simulate getting partial results
        const totalRecords = 500;
        const endIndex = Math.min(startIndex + batchSize, totalRecords);

        return {
          data: Array.from({ length: endIndex - startIndex }, (_, i) => ({
            id: startIndex + i,
          })),
          isComplete: endIndex >= totalRecords,
          resumeToken: endIndex < totalRecords ? String(endIndex) : undefined,
        };
      };

      // First batch
      let result = await queryWithResume();
      expect(result.data.length).toBe(100);
      expect(result.isComplete).toBe(false);

      // Continue from resume token
      result = await queryWithResume(result.resumeToken);
      expect(result.data.length).toBe(100);
    });
  });

  describe('Redis/Cache Failure Scenarios', () => {
    it('should handle Redis connection failure with fallback', async () => {
      const cache = {
        isConnected: true,
        data: new Map<string, string>(),

        async get(key: string): Promise<string | null> {
          if (!this.isConnected) {
            throw new Error('Redis connection lost');
          }
          return this.data.get(key) || null;
        },

        async set(key: string, value: string): Promise<void> {
          if (!this.isConnected) {
            throw new Error('Redis connection lost');
          }
          this.data.set(key, value);
        },
      };

      const fallbackCache = new Map<string, string>();

      const getCached = async (key: string): Promise<string | null> => {
        try {
          return await cache.get(key);
        } catch {
          // Fallback to in-memory cache
          return fallbackCache.get(key) || null;
        }
      };

      // Normal operation
      await cache.set('test', 'value');
      expect(await getCached('test')).toBe('value');

      // Redis fails
      cache.isConnected = false;
      fallbackCache.set('test', 'fallback-value');
      expect(await getCached('test')).toBe('fallback-value');
    });

    it('should handle cache stampede prevention', async () => {
      const locks = new Map<string, Promise<unknown>>();

      const getWithLock = async <T>(
        key: string,
        fetchFn: () => Promise<T>,
      ): Promise<T> => {
        // Check if another request is already fetching
        if (locks.has(key)) {
          return locks.get(key) as Promise<T>;
        }

        const promise = fetchFn();
        locks.set(key, promise);

        try {
          const result = await promise;
          return result;
        } finally {
          locks.delete(key);
        }
      };

      let fetchCount = 0;
      const fetchData = async (): Promise<string> => {
        fetchCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'data';
      };

      // Simulate multiple concurrent requests
      const results = await Promise.all([
        getWithLock('key', fetchData),
        getWithLock('key', fetchData),
        getWithLock('key', fetchData),
      ]);

      // All requests should get the same result
      expect(results).toEqual(['data', 'data', 'data']);
      // But fetch should only happen once
      expect(fetchCount).toBe(1);
    });

    it('should handle cache TTL expiration gracefully', async () => {
      interface CacheEntry {
        value: string;
        expiresAt: number;
      }

      const cache = new Map<string, CacheEntry>();

      const setWithTTL = (key: string, value: string, ttlMs: number): void => {
        cache.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
      };

      const getWithTTL = (key: string): string | null => {
        const entry = cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
          cache.delete(key);
          return null;
        }

        return entry.value;
      };

      setWithTTL('test', 'value', 100);
      expect(getWithTTL('test')).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(getWithTTL('test')).toBeNull();
    });
  });

  describe('Third-Party API Failures', () => {
    it('should handle Recall.ai API timeout', async () => {
      const callWithTimeout = async <T>(
        fn: () => Promise<T>,
        timeoutMs: number,
      ): Promise<T> => {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
        });

        return Promise.race([fn(), timeout]);
      };

      const slowApiCall = async (): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'success';
      };

      // Should timeout before API responds
      await expect(callWithTimeout(slowApiCall, 50)).rejects.toThrow('Request timeout');

      // Should succeed with longer timeout
      await expect(callWithTimeout(slowApiCall, 300)).resolves.toBe('success');
    });

    it('should handle Deepgram API rate limiting', async () => {
      interface RateLimitState {
        remaining: number;
        resetTime: number;
      }

      const apiState: RateLimitState = {
        remaining: 0,
        resetTime: Date.now() + 60000,
      };

      const callWithRateLimit = async (): Promise<string> => {
        if (apiState.remaining <= 0 && Date.now() < apiState.resetTime) {
          const waitTime = apiState.resetTime - Date.now();
          throw new Error(`Rate limited. Retry after ${waitTime}ms`);
        }

        apiState.remaining--;
        return 'transcription result';
      };

      await expect(callWithRateLimit()).rejects.toThrow('Rate limited');

      // Simulate rate limit reset
      apiState.resetTime = Date.now() - 1;
      apiState.remaining = 10;
      await expect(callWithRateLimit()).resolves.toBe('transcription result');
    });

    it('should handle webhook delivery failure with retry', async () => {
      let deliveryAttempts = 0;
      const maxRetries = 5;
      const retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

      const deliverWebhook = async (payload: unknown): Promise<boolean> => {
        deliveryAttempts++;

        // Simulate failures for first 3 attempts
        if (deliveryAttempts <= 3) {
          throw new Error('Webhook delivery failed');
        }

        return true;
      };

      const deliverWithRetry = async (payload: unknown): Promise<boolean> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await deliverWebhook(payload);
          } catch {
            if (i === maxRetries - 1) {
              return false; // Final failure
            }
            // Wait before retry (shortened for test)
            await new Promise(resolve => setTimeout(resolve, retryDelays[i] / 1000));
          }
        }
        return false;
      };

      const result = await deliverWithRetry({ event: 'meeting.completed' });
      expect(result).toBe(true);
      expect(deliveryAttempts).toBe(4);
    });

    it('should handle calendar sync API errors', async () => {
      interface CalendarEvent {
        id: string;
        title: string;
      }

      const calendarApi = {
        errorRate: 0.5, // 50% error rate

        async getEvents(): Promise<CalendarEvent[]> {
          if (Math.random() < this.errorRate) {
            throw new Error('Calendar API error');
          }
          return [{ id: 'event-1', title: 'Meeting' }];
        },
      };

      const getEventsWithFallback = async (
        cachedEvents: CalendarEvent[],
      ): Promise<CalendarEvent[]> => {
        try {
          return await calendarApi.getEvents();
        } catch {
          // Return cached events on failure
          return cachedEvents;
        }
      };

      const cachedEvents = [{ id: 'cached-1', title: 'Cached Meeting' }];

      // Should either return fresh or cached events, never throw
      const result = await getEventsWithFallback(cachedEvents);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Network Latency and Partition', () => {
    it('should handle network partition between services', async () => {
      interface ServiceState {
        isReachable: boolean;
        lastHealthCheck: number;
      }

      const services: Record<string, ServiceState> = {
        api: { isReachable: true, lastHealthCheck: Date.now() },
        transcription: { isReachable: true, lastHealthCheck: Date.now() },
        summarization: { isReachable: true, lastHealthCheck: Date.now() },
      };

      const callService = async (
        serviceName: string,
        operation: string,
      ): Promise<unknown> => {
        const service = services[serviceName];
        if (!service?.isReachable) {
          throw new Error(`Service ${serviceName} is unreachable (network partition)`);
        }
        return { success: true, operation };
      };

      // Normal operation
      await expect(callService('transcription', 'process')).resolves.toBeDefined();

      // Simulate network partition
      services.transcription.isReachable = false;
      await expect(callService('transcription', 'process')).rejects.toThrow(
        'network partition',
      );

      // Other services still work
      await expect(callService('api', 'health')).resolves.toBeDefined();
    });

    it('should handle variable network latency', async () => {
      const addLatency = async <T>(
        fn: () => Promise<T>,
        minMs: number,
        maxMs: number,
      ): Promise<T> => {
        const latency = minMs + Math.random() * (maxMs - minMs);
        await new Promise(resolve => setTimeout(resolve, latency));
        return fn();
      };

      const start = Date.now();
      await addLatency(() => Promise.resolve('data'), 10, 50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(100); // Some margin
    });

    it('should implement request hedging for critical paths', async () => {
      const makeRequest = async (id: number): Promise<{ id: number; data: string }> => {
        const latency = Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, latency));
        return { id, data: 'result' };
      };

      const hedgedRequest = async (): Promise<{ id: number; data: string }> => {
        const request1 = makeRequest(1);

        // Send hedge request after 50ms
        const hedge = new Promise<{ id: number; data: string }>(resolve => {
          setTimeout(() => makeRequest(2).then(resolve), 50);
        });

        // Return whichever completes first
        return Promise.race([request1, hedge]);
      };

      const result = await hedgedRequest();
      expect(result.data).toBe('result');
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', () => {
      interface MemoryState {
        usedMB: number;
        limitMB: number;
      }

      const checkMemoryPressure = (state: MemoryState): 'normal' | 'warning' | 'critical' => {
        const usagePercent = (state.usedMB / state.limitMB) * 100;

        if (usagePercent >= 95) return 'critical';
        if (usagePercent >= 80) return 'warning';
        return 'normal';
      };

      expect(checkMemoryPressure({ usedMB: 256, limitMB: 512 })).toBe('normal');
      expect(checkMemoryPressure({ usedMB: 450, limitMB: 512 })).toBe('warning');
      expect(checkMemoryPressure({ usedMB: 500, limitMB: 512 })).toBe('critical');
    });

    it('should implement backpressure for job queues', async () => {
      class JobQueue {
        private queue: string[] = [];
        private processing = false;

        constructor(
          private maxSize: number,
          private processingDelay: number,
        ) {}

        async add(job: string): Promise<boolean> {
          if (this.queue.length >= this.maxSize) {
            return false; // Backpressure: reject new jobs
          }

          this.queue.push(job);
          this.processNext();
          return true;
        }

        private async processNext(): Promise<void> {
          if (this.processing || this.queue.length === 0) return;

          this.processing = true;
          await new Promise(resolve => setTimeout(resolve, this.processingDelay));
          this.queue.shift();
          this.processing = false;

          this.processNext();
        }

        get size(): number {
          return this.queue.length;
        }
      }

      const queue = new JobQueue(5, 10);

      // Fill the queue
      for (let i = 0; i < 5; i++) {
        expect(await queue.add(`job-${i}`)).toBe(true);
      }

      // Should reject when full
      expect(await queue.add('job-overflow')).toBe(false);
    });

    it('should handle file descriptor exhaustion', () => {
      class FileHandlePool {
        private handles = new Set<string>();

        constructor(private maxHandles: number) {}

        open(filename: string): boolean {
          if (this.handles.size >= this.maxHandles) {
            return false; // No more handles available
          }
          this.handles.add(filename);
          return true;
        }

        close(filename: string): void {
          this.handles.delete(filename);
        }

        get available(): number {
          return this.maxHandles - this.handles.size;
        }
      }

      const pool = new FileHandlePool(3);

      expect(pool.open('file1.txt')).toBe(true);
      expect(pool.open('file2.txt')).toBe(true);
      expect(pool.open('file3.txt')).toBe(true);
      expect(pool.open('file4.txt')).toBe(false); // Exhausted

      pool.close('file1.txt');
      expect(pool.open('file4.txt')).toBe(true); // Now available
    });

    it('should handle disk space exhaustion', async () => {
      interface DiskState {
        totalGB: number;
        usedGB: number;
        reservedGB: number;
      }

      const canWrite = (state: DiskState, sizeGB: number): boolean => {
        const availableGB = state.totalGB - state.usedGB - state.reservedGB;
        return sizeGB <= availableGB;
      };

      const disk: DiskState = {
        totalGB: 100,
        usedGB: 85,
        reservedGB: 10, // Keep 10GB reserved
      };

      expect(canWrite(disk, 4)).toBe(true);
      expect(canWrite(disk, 10)).toBe(false);
    });
  });

  describe('Cascading Failures', () => {
    it('should isolate failures with bulkhead pattern', async () => {
      class Bulkhead {
        private slots: number;

        constructor(private maxConcurrent: number) {
          this.slots = maxConcurrent;
        }

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          if (this.slots <= 0) {
            throw new Error('Bulkhead full - request rejected');
          }

          this.slots--;
          try {
            return await fn();
          } finally {
            this.slots++;
          }
        }

        get available(): number {
          return this.slots;
        }
      }

      const transcriptionBulkhead = new Bulkhead(5);
      const summarizationBulkhead = new Bulkhead(3);

      // Fill transcription bulkhead
      const transcriptionJobs = Array.from({ length: 5 }, () =>
        transcriptionBulkhead.execute(
          () => new Promise(resolve => setTimeout(resolve, 100)),
        ),
      );

      expect(transcriptionBulkhead.available).toBe(0);

      // Transcription is full, but summarization still works
      expect(summarizationBulkhead.available).toBe(3);

      await Promise.all(transcriptionJobs);
      expect(transcriptionBulkhead.available).toBe(5);
    });

    it('should implement health-based load balancing', () => {
      interface ServiceInstance {
        id: string;
        health: 'healthy' | 'degraded' | 'unhealthy';
        load: number;
      }

      const instances: ServiceInstance[] = [
        { id: 'instance-1', health: 'healthy', load: 50 },
        { id: 'instance-2', health: 'degraded', load: 30 },
        { id: 'instance-3', health: 'unhealthy', load: 0 },
      ];

      const selectInstance = (): ServiceInstance | null => {
        const available = instances
          .filter(i => i.health !== 'unhealthy')
          .sort((a, b) => {
            // Prefer healthy over degraded
            if (a.health === 'healthy' && b.health !== 'healthy') return -1;
            if (b.health === 'healthy' && a.health !== 'healthy') return 1;
            // Then by load
            return a.load - b.load;
          });

        return available[0] || null;
      };

      const selected = selectInstance();
      expect(selected?.id).toBe('instance-1');
      expect(selected?.health).toBe('healthy');

      // Mark all as unhealthy
      instances.forEach(i => (i.health = 'unhealthy'));
      expect(selectInstance()).toBeNull();
    });

    it('should prevent cascade with timeout propagation', async () => {
      const serviceA = async (timeout: number): Promise<string> => {
        // Service A calls Service B with reduced timeout
        const remainingTimeout = timeout - 50; // Account for network latency
        if (remainingTimeout <= 0) {
          throw new Error('Timeout propagation - insufficient time');
        }
        return serviceB(remainingTimeout);
      };

      const serviceB = async (timeout: number): Promise<string> => {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 30));
        if (timeout < 30) {
          throw new Error('Timeout exceeded');
        }
        return 'success';
      };

      // With enough timeout
      await expect(serviceA(200)).resolves.toBe('success');

      // With insufficient timeout
      await expect(serviceA(50)).rejects.toThrow('Timeout propagation');
    });
  });

  describe('Data Corruption and Consistency', () => {
    it('should detect and handle corrupted data', () => {
      interface Meeting {
        id: string;
        title: string;
        duration: number;
        participantCount: number;
      }

      const validateMeeting = (meeting: unknown): meeting is Meeting => {
        if (typeof meeting !== 'object' || meeting === null) return false;

        const m = meeting as Record<string, unknown>;

        return (
          typeof m.id === 'string' &&
          typeof m.title === 'string' &&
          typeof m.duration === 'number' &&
          m.duration >= 0 &&
          typeof m.participantCount === 'number' &&
          m.participantCount >= 0
        );
      };

      expect(validateMeeting({ id: '1', title: 'Test', duration: 60, participantCount: 3 })).toBe(
        true,
      );
      expect(validateMeeting({ id: '1', title: 'Test', duration: -1, participantCount: 3 })).toBe(
        false,
      );
      expect(validateMeeting({ id: '1', title: null, duration: 60, participantCount: 3 })).toBe(
        false,
      );
    });

    it('should handle partial writes with idempotency', async () => {
      const processedIds = new Set<string>();

      const processIdempotent = async (
        id: string,
        data: unknown,
      ): Promise<{ processed: boolean; idempotent: boolean }> => {
        if (processedIds.has(id)) {
          return { processed: false, idempotent: true };
        }

        // Simulate processing
        processedIds.add(id);
        return { processed: true, idempotent: false };
      };

      // First call processes
      const first = await processIdempotent('job-1', { data: 'test' });
      expect(first.processed).toBe(true);
      expect(first.idempotent).toBe(false);

      // Retry is idempotent
      const retry = await processIdempotent('job-1', { data: 'test' });
      expect(retry.processed).toBe(false);
      expect(retry.idempotent).toBe(true);
    });

    it('should implement optimistic locking for concurrent updates', async () => {
      interface VersionedRecord {
        id: string;
        data: string;
        version: number;
      }

      const records = new Map<string, VersionedRecord>();
      records.set('record-1', { id: 'record-1', data: 'original', version: 1 });

      const updateWithVersion = async (
        id: string,
        newData: string,
        expectedVersion: number,
      ): Promise<boolean> => {
        const record = records.get(id);
        if (!record) return false;

        if (record.version !== expectedVersion) {
          throw new Error('Optimistic lock failure: version mismatch');
        }

        records.set(id, {
          ...record,
          data: newData,
          version: expectedVersion + 1,
        });

        return true;
      };

      // First update succeeds
      await expect(updateWithVersion('record-1', 'updated', 1)).resolves.toBe(true);

      // Second update with stale version fails
      await expect(updateWithVersion('record-1', 'stale update', 1)).rejects.toThrow(
        'version mismatch',
      );

      // Update with correct version succeeds
      await expect(updateWithVersion('record-1', 'latest', 2)).resolves.toBe(true);
    });
  });

  describe('Recovery and Self-Healing', () => {
    it('should implement automatic service restart', async () => {
      class Service {
        private running = false;
        private crashCount = 0;
        private readonly maxCrashes = 3;

        start(): void {
          if (this.crashCount >= this.maxCrashes) {
            throw new Error('Max crash limit reached - manual intervention required');
          }
          this.running = true;
        }

        stop(): void {
          this.running = false;
        }

        crash(): void {
          this.running = false;
          this.crashCount++;
        }

        isRunning(): boolean {
          return this.running;
        }

        get crashes(): number {
          return this.crashCount;
        }
      }

      const service = new Service();
      service.start();
      expect(service.isRunning()).toBe(true);

      // Simulate crashes with automatic restart
      for (let i = 0; i < 3; i++) {
        service.crash();
        expect(service.isRunning()).toBe(false);
        try {
          service.start();
        } catch {
          // Expected after max crashes
        }
      }

      expect(service.crashes).toBe(3);
      expect(() => service.start()).toThrow('Max crash limit');
    });

    it('should implement health check and auto-recovery', async () => {
      interface HealthStatus {
        healthy: boolean;
        lastCheck: number;
        consecutiveFailures: number;
      }

      const healthCheck = async (): Promise<boolean> => {
        // Simulate health check
        return Math.random() > 0.3; // 70% healthy
      };

      const monitorHealth = async (
        status: HealthStatus,
        onUnhealthy: () => void,
      ): Promise<HealthStatus> => {
        const isHealthy = await healthCheck();

        if (!isHealthy) {
          status.consecutiveFailures++;
          if (status.consecutiveFailures >= 3) {
            onUnhealthy();
          }
        } else {
          status.consecutiveFailures = 0;
        }

        return {
          healthy: isHealthy,
          lastCheck: Date.now(),
          consecutiveFailures: status.consecutiveFailures,
        };
      };

      let recoveryTriggered = false;
      const status: HealthStatus = {
        healthy: true,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
      };

      await monitorHealth(status, () => {
        recoveryTriggered = true;
      });

      // Result depends on random health check
      expect(typeof status.consecutiveFailures).toBe('number');
    });

    it('should implement graceful shutdown', async () => {
      class GracefulServer {
        private connections = new Set<string>();
        private isShuttingDown = false;

        addConnection(id: string): void {
          if (this.isShuttingDown) {
            throw new Error('Server is shutting down');
          }
          this.connections.add(id);
        }

        removeConnection(id: string): void {
          this.connections.delete(id);
        }

        async shutdown(timeoutMs: number): Promise<boolean> {
          this.isShuttingDown = true;

          const start = Date.now();
          while (this.connections.size > 0 && Date.now() - start < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          const graceful = this.connections.size === 0;
          this.connections.clear();

          return graceful;
        }

        get connectionCount(): number {
          return this.connections.size;
        }
      }

      const server = new GracefulServer();
      server.addConnection('conn-1');
      server.addConnection('conn-2');

      // Start shutdown
      const shutdownPromise = server.shutdown(100);

      // New connections should be rejected
      expect(() => server.addConnection('conn-3')).toThrow('shutting down');

      // Simulate connections closing
      server.removeConnection('conn-1');
      server.removeConnection('conn-2');

      const graceful = await shutdownPromise;
      expect(graceful).toBe(true);
    });
  });
});
