/**
 * Tests for Metrics Collector Middleware
 */

import { Request, Response, NextFunction } from 'express';

// Create mock functions
const mockRecordMetric = jest.fn();
const mockIncrementMetric = jest.fn();

// Mock the alert service before importing the module
jest.mock('../monitoring/alertService', () => ({
  getAlertService: jest.fn(() => ({
    recordMetric: mockRecordMetric,
    incrementMetric: mockIncrementMetric,
  })),
}));

// Import after mocking
import {
  metricsCollector,
  getMetricsSnapshot,
  recordCustomMetric,
  incrementCounter,
  recordTranscriptionFailure,
  recordPaymentFailure,
  recordDbPoolUsage,
  recordRedisConnectionError,
} from './metricsCollector';

describe('metricsCollector', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalEnd: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    originalEnd = jest.fn(function(this: Response) {
      return this;
    });

    mockReq = {
      method: 'GET',
      path: '/api/v1/test',
      route: { path: '/api/v1/test' },
    };

    mockRes = {
      statusCode: 200,
      end: originalEnd,
    };

    mockNext = jest.fn();
  });

  it('should call next middleware', () => {
    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should override res.end', () => {
    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.end).not.toBe(originalEnd);
  });

  it('should call original res.end when response ends', () => {
    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    (mockRes as Response).end();

    expect(originalEnd).toHaveBeenCalled();
  });

  it('should track auth failures for 401 status', () => {
    mockRes.statusCode = 401;

    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    (mockRes as Response).end();

    expect(mockIncrementMetric).toHaveBeenCalledWith('auth_failures');
  });

  it('should track auth failures for 403 status', () => {
    mockRes.statusCode = 403;

    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    (mockRes as Response).end();

    expect(mockIncrementMetric).toHaveBeenCalledWith('auth_failures');
  });

  it('should track rate limit hits for 429 status', () => {
    mockRes.statusCode = 429;

    metricsCollector(mockReq as Request, mockRes as Response, mockNext);
    (mockRes as Response).end();

    expect(mockIncrementMetric).toHaveBeenCalledWith('rate_limit_hits');
  });
});

describe('getMetricsSnapshot', () => {
  it('should return metrics snapshot with all required fields', () => {
    const snapshot = getMetricsSnapshot();

    expect(snapshot).toHaveProperty('requestCount');
    expect(snapshot).toHaveProperty('errorCount');
    expect(snapshot).toHaveProperty('errorRate');
    expect(snapshot).toHaveProperty('latencyP50');
    expect(snapshot).toHaveProperty('latencyP95');
    expect(snapshot).toHaveProperty('latencyP99');
    expect(snapshot).toHaveProperty('statusCodes');
    expect(snapshot).toHaveProperty('topRoutes');
  });

  it('should return array for topRoutes', () => {
    const snapshot = getMetricsSnapshot();
    expect(Array.isArray(snapshot.topRoutes)).toBe(true);
  });
});

describe('recordCustomMetric', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call alertService.recordMetric', () => {
    recordCustomMetric('custom_metric', 42);
    expect(mockRecordMetric).toHaveBeenCalledWith('custom_metric', 42);
  });
});

describe('incrementCounter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call alertService.incrementMetric with default amount', () => {
    incrementCounter('custom_counter');
    expect(mockIncrementMetric).toHaveBeenCalledWith('custom_counter', 1);
  });

  it('should call alertService.incrementMetric with custom amount', () => {
    incrementCounter('custom_counter', 5);
    expect(mockIncrementMetric).toHaveBeenCalledWith('custom_counter', 5);
  });
});

describe('recordTranscriptionFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment transcription_failures metric', () => {
    recordTranscriptionFailure();
    expect(mockIncrementMetric).toHaveBeenCalledWith('transcription_failures');
  });
});

describe('recordPaymentFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment payment_failures metric', () => {
    recordPaymentFailure();
    expect(mockIncrementMetric).toHaveBeenCalledWith('payment_failures');
  });
});

describe('recordDbPoolUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should record db_pool_usage_percent metric', () => {
    recordDbPoolUsage(75);
    expect(mockRecordMetric).toHaveBeenCalledWith('db_pool_usage_percent', 75);
  });
});

describe('recordRedisConnectionError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment redis_connection_errors metric', () => {
    recordRedisConnectionError();
    expect(mockIncrementMetric).toHaveBeenCalledWith('redis_connection_errors');
  });
});
