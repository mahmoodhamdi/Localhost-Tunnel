import { SUBDOMAIN } from './constants.js';

/**
 * Generate a random subdomain
 */
export function generateSubdomain(): string {
  const adjectives = [
    'happy', 'clever', 'swift', 'bright', 'calm', 'eager', 'fair', 'gentle',
    'jolly', 'kind', 'lively', 'nice', 'proud', 'quick', 'smart', 'witty',
  ];
  const nouns = [
    'tunnel', 'bridge', 'portal', 'gate', 'link', 'path', 'route', 'channel',
    'stream', 'flow', 'pipe', 'way', 'road', 'lane', 'trail', 'track',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}-${noun}-${number}`;
}

/**
 * Validate subdomain format
 */
export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain) {
    return { valid: false, error: 'Subdomain is required' };
  }

  if (subdomain.length < SUBDOMAIN.MIN_LENGTH) {
    return { valid: false, error: `Subdomain must be at least ${SUBDOMAIN.MIN_LENGTH} characters` };
  }

  if (subdomain.length > SUBDOMAIN.MAX_LENGTH) {
    return { valid: false, error: `Subdomain must be at most ${SUBDOMAIN.MAX_LENGTH} characters` };
  }

  if (!SUBDOMAIN.PATTERN.test(subdomain)) {
    return { valid: false, error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' };
  }

  if ((SUBDOMAIN.RESERVED as readonly string[]).includes(subdomain)) {
    return { valid: false, error: 'This subdomain is reserved' };
  }

  return { valid: true };
}

/**
 * Validate port number
 */
export function validatePort(port: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(port)) {
    return { valid: false, error: 'Port must be an integer' };
  }

  if (port < 1 || port > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }

  return { valid: true };
}

/**
 * Parse IP whitelist string into array
 */
export function parseIpWhitelist(whitelist: string): string[] {
  if (!whitelist || whitelist.trim() === '') {
    return [];
  }

  return whitelist
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);
}

/**
 * Check if IP matches whitelist (supports CIDR notation)
 */
export function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    return true;
  }

  for (const allowed of whitelist) {
    if (allowed.includes('/')) {
      // CIDR notation
      if (isIpInCidr(ip, allowed)) {
        return true;
      }
    } else if (ip === allowed) {
      return true;
    }
  }

  return false;
}

/**
 * Check if IP is in CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate unique tunnel ID
 */
export function generateTunnelId(): string {
  return `tn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
