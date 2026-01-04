/**
 * Jest test setup for database package
 */

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  // Setup code that runs once before all tests
});

afterAll(() => {
  // Cleanup code that runs once after all tests
});

beforeEach(() => {
  // Reset mocks between tests
  jest.clearAllMocks();
});
