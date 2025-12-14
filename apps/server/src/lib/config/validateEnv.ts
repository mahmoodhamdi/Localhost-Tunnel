/**
 * Environment variable validation for production readiness
 * This module validates that all required environment variables are set
 * and provides warnings for recommended variables.
 */

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Required environment variables for production
const REQUIRED_ENV_VARS = [
  {
    name: 'DATABASE_URL',
    description: 'Database connection string',
  },
  {
    name: 'NEXTAUTH_SECRET',
    description: 'Secret for NextAuth.js session encryption',
  },
  {
    name: 'NEXTAUTH_URL',
    description: 'Base URL for NextAuth.js callbacks',
  },
];

// Required in production only
const PRODUCTION_REQUIRED_ENV_VARS = [
  {
    name: 'ENCRYPTION_MASTER_KEY',
    description: 'Master key for encrypting sensitive data (64 hex chars)',
    validate: (value: string) => /^[a-fA-F0-9]{64}$/.test(value),
    errorMessage: 'Must be a 64-character hex string. Generate with: openssl rand -hex 32',
  },
];

// Recommended environment variables
const RECOMMENDED_ENV_VARS = [
  {
    name: 'TUNNEL_DOMAIN',
    description: 'Domain for tunnel URLs',
    default: 'localhost:3000',
  },
  {
    name: 'GITHUB_CLIENT_ID',
    description: 'GitHub OAuth client ID for authentication',
  },
  {
    name: 'GITHUB_CLIENT_SECRET',
    description: 'GitHub OAuth client secret',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID for authentication',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret',
  },
];

/**
 * Validates environment variables
 * @param strict If true, treats missing production variables as errors even in development
 */
export function validateEnvironment(strict: boolean = false): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar.name]) {
      errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`);
    }
  }

  // Check production-required variables
  for (const envVar of PRODUCTION_REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      if (isProduction || strict) {
        errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`);
      } else {
        warnings.push(
          `Missing recommended environment variable: ${envVar.name} - ${envVar.description}. ` +
            'Required in production.'
        );
      }
    } else if (envVar.validate && !envVar.validate(value)) {
      errors.push(`Invalid ${envVar.name}: ${envVar.errorMessage}`);
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar.name]) {
      const defaultNote = envVar.default ? ` (using default: ${envVar.default})` : '';
      warnings.push(
        `Missing optional environment variable: ${envVar.name} - ${envVar.description}${defaultNote}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws if invalid
 * Call this at application startup
 */
export function ensureValidEnvironment(): void {
  const result = validateEnvironment();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('Environment validation warnings:');
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  // Throw if errors
  if (!result.valid) {
    console.error('Environment validation failed:');
    result.errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error(
      `Environment validation failed with ${result.errors.length} error(s). ` +
        'Please set the required environment variables.'
    );
  }

  console.log('Environment validation passed');
}

/**
 * Get a required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}
