/**
 * Environment validation utility
 * Validates required environment variables at startup
 */

import * as fs from 'fs';
import * as path from 'path';

interface EnvRequirement {
  name: string;
  required: boolean;
  phase: number;
  validate?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_REQUIREMENTS: EnvRequirement[] = [
  // Phase 0 - Core infrastructure
  { name: 'DATABASE_URL', required: true, phase: 0 },
  { name: 'REDIS_URL', required: true, phase: 0 },
  { name: 'NODE_ENV', required: true, phase: 0 },

  // Phase 2 - Authentication & Calendar
  { name: 'CLERK_SECRET_KEY', required: true, phase: 2 },
  { name: 'GOOGLE_CLIENT_ID', required: true, phase: 2 },
  { name: 'GOOGLE_CLIENT_SECRET', required: true, phase: 2 },

  // Phase 3 - Meeting Bots & Transcription
  { name: 'RECALL_API_KEY', required: true, phase: 3 },
  { name: 'DEEPGRAM_API_KEY', required: true, phase: 3 },

  // Phase 4 - AI Summarization
  { name: 'ANTHROPIC_API_KEY', required: true, phase: 4 },
  { name: 'OPENAI_API_KEY', required: true, phase: 4 },

  // Phase 6 - Integrations & Billing
  { name: 'STRIPE_SECRET_KEY', required: true, phase: 6 },

  // Phase 7 - Admin Panel
  {
    name: 'ADMIN_JWT_SECRET',
    required: true,
    phase: 7,
    validate: (v) => v.length >= 32,
    errorMessage: 'ADMIN_JWT_SECRET must be at least 32 characters',
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    phase: 7,
    validate: (v) => v.length >= 32,
    errorMessage: 'ENCRYPTION_KEY must be at least 32 characters',
  },
];

/**
 * Validates environment variables for the current phase
 * @param currentPhase - The current development phase (0-8)
 */
export function validateEnvironment(currentPhase: number = 8): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of ENV_REQUIREMENTS) {
    const value = process.env[req.name];

    if (req.phase <= currentPhase && req.required) {
      if (!value) {
        errors.push(`Missing required env var: ${req.name}`);
      } else if (req.validate && !req.validate(value)) {
        errors.push(req.errorMessage || `Invalid value for ${req.name}`);
      }
    } else if (!value && req.required) {
      warnings.push(`${req.name} not set (required in Phase ${req.phase})`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\u26A0\uFE0F  Environment warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.error('\u274C Environment validation failed:');
    errors.forEach((e) => console.error(`   - ${e}`));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  } else {
    console.log('\u2705 Environment validation passed');
  }
}

/**
 * Detects current phase by checking which PHASE_X_COMPLETE.md exists
 * @returns The next phase number (current + 1)
 */
export function getCurrentPhase(): number {
  // Try to find the project root by looking for package.json
  let currentDir = process.cwd();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    // Check for phase completion files
    for (let i = 8; i >= 0; i--) {
      const phasePath = path.join(currentDir, `PHASE_${i}_COMPLETE.md`);
      if (fs.existsSync(phasePath)) {
        return i + 1; // Next phase
      }
    }

    // Move up a directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
    attempts++;
  }

  return 0;
}

/**
 * Force UTC timezone
 */
export function enforceUTC(): void {
  if (process.env.TZ !== 'UTC') {
    process.env.TZ = 'UTC';
  }
}

// Auto-enforce UTC when module is imported
enforceUTC();
