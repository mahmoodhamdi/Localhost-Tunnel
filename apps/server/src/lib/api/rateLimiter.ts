/**
 * In-Memory Rate Limiter
 * Provides rate limiting for API endpoints
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
}

class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly cleanupInterval = 60000; // Clean up every minute

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      // Remove entries older than 10 minutes
      if (now - entry.windowStart > 600000) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Check if a request is allowed under rate limits
   * @param key Unique identifier (e.g., IP address or user ID)
   * @param config Rate limit configuration
   * @returns Object with allowed status and remaining requests
   */
  check(
    key: string,
    config: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.entries.get(key);

    // No entry exists - create new window
    if (!entry) {
      this.entries.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Window has expired - reset
    if (now - entry.windowStart >= config.windowMs) {
      entry.count = 1;
      entry.windowStart = now;
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Within window - check limit
    const resetTime = entry.windowStart + config.windowMs;

    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Allow and increment
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime,
    };
  }

  /**
   * Clear rate limit for a specific key
   */
  clear(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Shutdown the rate limiter
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  /** File upload: 10 uploads per minute */
  UPLOAD: {
    windowMs: 60000,
    maxRequests: 10,
  },
  /** Registration: 5 attempts per hour */
  REGISTER: {
    windowMs: 3600000,
    maxRequests: 5,
  },
  /** Password reset: 3 attempts per hour */
  PASSWORD_RESET: {
    windowMs: 3600000,
    maxRequests: 3,
  },
  /** API key creation: 10 per hour */
  API_KEY_CREATE: {
    windowMs: 3600000,
    maxRequests: 10,
  },
  /** Team creation: 10 per hour */
  TEAM_CREATE: {
    windowMs: 3600000,
    maxRequests: 10,
  },
  /** Generic write operations: 60 per minute */
  WRITE: {
    windowMs: 60000,
    maxRequests: 60,
  },
};

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Check common headers for proxied requests
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Default fallback
  return 'unknown';
}

/**
 * Create a rate limit key from user ID or IP
 */
export function createRateLimitKey(
  prefix: string,
  userId?: string | null,
  ip?: string
): string {
  const identifier = userId || ip || 'anonymous';
  return `${prefix}:${identifier}`;
}
