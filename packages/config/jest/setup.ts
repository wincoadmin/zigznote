/**
 * Global Jest setup file
 * Enforces UTC timezone and validates test environment
 */

// Force UTC timezone for all tests
process.env.TZ = 'UTC';

// Verify timezone is set correctly
const now = new Date();
const offset = now.getTimezoneOffset();
if (offset !== 0) {
  console.warn(`\u26A0\uFE0F Timezone offset is ${offset}, expected 0 (UTC)`);
}

// Set test environment
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Validate test environment variables
const requiredTestEnv = ['DATABASE_URL_TEST', 'DATABASE_URL'];
const missingEnv: string[] = [];

for (const envVar of requiredTestEnv) {
  if (!process.env[envVar]) {
    missingEnv.push(envVar);
  }
}

if (missingEnv.length > 0 && !process.env.DATABASE_URL) {
  console.warn(`\u26A0\uFE0F Missing test env vars: ${missingEnv.join(', ')}`);
  console.warn('   Tests requiring database may fail.');
}

// Set reasonable test timeout
jest.setTimeout(30000);

// Cleanup database connections after all tests
afterAll(async () => {
  // Import dynamically to avoid issues if prisma isn't set up yet
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require('@zigznote/database');
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  } catch {
    // Prisma not available yet, that's fine
  }
});
