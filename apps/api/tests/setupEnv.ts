/**
 * Jest environment setup file
 * This runs BEFORE test modules are loaded
 * Used to set environment variables needed for config
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.API_PORT = '3099';
process.env.CORS_ORIGINS = 'http://localhost:3000';
