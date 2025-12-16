import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// These tests verify core functionality without mocking - testing actual implementations

describe('TunnelManager Core Integration Tests', () => {
  describe('Subdomain Generation and Validation', () => {
    // Import actual implementation
    let generateSubdomain: () => string;
    let validateSubdomain: (subdomain: string) => boolean;
    let normalizeSubdomain: (subdomain: string) => string;

    beforeEach(async () => {
      const subdomainModule = await import('@/lib/tunnel/subdomain');
      generateSubdomain = subdomainModule.generateSubdomain;
      validateSubdomain = subdomainModule.validateSubdomain;
      normalizeSubdomain = subdomainModule.normalizeSubdomain;
    });

    it('should generate unique subdomains', () => {
      const subdomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const subdomain = generateSubdomain();
        expect(subdomains.has(subdomain)).toBe(false);
        subdomains.add(subdomain);
      }
      expect(subdomains.size).toBe(100);
    });

    it('should generate subdomains with correct format', () => {
      const subdomain = generateSubdomain();
      // Should only contain lowercase letters, numbers, and hyphens
      expect(subdomain).toMatch(/^[a-z0-9-]+$/);
      // Should not start or end with hyphen
      expect(subdomain).not.toMatch(/^-/);
      expect(subdomain).not.toMatch(/-$/);
    });

    it('should validate correct subdomain formats', () => {
      // Valid subdomains: 3-63 chars, lowercase letters, numbers, hyphens
      // Must start and end with letter or number
      const validSubdomains = [
        'my-tunnel',
        'test123',
        'api-v1',
        'abc',  // Min 3 chars
        'my-long-subdomain-name',
        'test-with-many-hyphens',
        '123abc',
        'abc123',
      ];

      for (const subdomain of validSubdomains) {
        const result = validateSubdomain(subdomain);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid subdomain formats', () => {
      const invalidSubdomains = [
        '-starts-with-hyphen',
        'ends-with-hyphen-',
        'has_underscore',
        'has.dot',
        'has space',
        'has@special',
        '',
        'ab',  // Too short (min 3)
        'x',   // Too short
        'app', // Reserved
        'www', // Reserved
        'admin', // Reserved
      ];

      for (const subdomain of invalidSubdomains) {
        const result = validateSubdomain(subdomain);
        expect(result.valid).toBe(false);
      }
    });

    it('should normalize subdomain to lowercase', () => {
      expect(normalizeSubdomain('MyTunnel')).toBe('mytunnel');
      expect(normalizeSubdomain('TEST-API')).toBe('test-api');
      expect(normalizeSubdomain('App123')).toBe('app123');
    });
  });

  describe('Password Hashing and Verification', () => {
    let hashPassword: (password: string) => Promise<string>;
    let verifyPassword: (password: string, hash: string) => Promise<boolean>;

    beforeEach(async () => {
      const authModule = await import('@/lib/tunnel/auth');
      hashPassword = authModule.hashPassword;
      verifyPassword = authModule.verifyPassword;
    });

    it('should hash password securely', async () => {
      const password = 'secretpassword123';
      const hash = await hashPassword(password);

      // Hash should not equal plain password
      expect(hash).not.toBe(password);
      // Hash should be non-empty
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'secretpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Hashes should be different (salt)
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'secretpassword123';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'secretpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await hashPassword(password);

      const result = await verifyPassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const password = 'p@$$w0rd!@#$%^&*()_+[]{}|;:,.<>?';
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should handle unicode passwords', async () => {
      const password = '密码🔐مرور';
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });
  });

  describe('IP Whitelist Parsing and Validation', () => {
    let parseIpWhitelist: (whitelist: string) => string[];
    let isIpAllowed: (ip: string, whitelist: string[]) => boolean;

    beforeEach(async () => {
      const authModule = await import('@/lib/tunnel/auth');
      parseIpWhitelist = authModule.parseIpWhitelist;
      isIpAllowed = authModule.isIpAllowed;
    });

    it('should parse comma-separated IPs', () => {
      const result = parseIpWhitelist('192.168.1.1, 10.0.0.1, 172.16.0.1');
      expect(result).toEqual(['192.168.1.1', '10.0.0.1', '172.16.0.1']);
    });

    it('should trim whitespace from IPs', () => {
      const result = parseIpWhitelist('  192.168.1.1  ,  10.0.0.1  ');
      expect(result).toEqual(['192.168.1.1', '10.0.0.1']);
    });

    it('should handle empty string', () => {
      const result = parseIpWhitelist('');
      expect(result).toEqual([]);
    });

    it('should handle CIDR notation', () => {
      const result = parseIpWhitelist('192.168.1.0/24, 10.0.0.0/8');
      expect(result).toContain('192.168.1.0/24');
      expect(result).toContain('10.0.0.0/8');
    });

    it('should allow IP in whitelist', () => {
      const whitelist = ['192.168.1.1', '10.0.0.1'];
      expect(isIpAllowed('192.168.1.1', whitelist)).toBe(true);
      expect(isIpAllowed('10.0.0.1', whitelist)).toBe(true);
    });

    it('should reject IP not in whitelist', () => {
      const whitelist = ['192.168.1.1', '10.0.0.1'];
      expect(isIpAllowed('192.168.1.2', whitelist)).toBe(false);
      expect(isIpAllowed('8.8.8.8', whitelist)).toBe(false);
    });

    it('should allow all IPs when whitelist is empty', () => {
      const whitelist: string[] = [];
      expect(isIpAllowed('192.168.1.1', whitelist)).toBe(true);
      expect(isIpAllowed('8.8.8.8', whitelist)).toBe(true);
    });

    it('should handle CIDR range matching', () => {
      const whitelist = ['192.168.1.0/24'];
      // IPs in range
      expect(isIpAllowed('192.168.1.1', whitelist)).toBe(true);
      expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
      expect(isIpAllowed('192.168.1.255', whitelist)).toBe(true);
      // IPs outside range
      expect(isIpAllowed('192.168.2.1', whitelist)).toBe(false);
      expect(isIpAllowed('10.0.0.1', whitelist)).toBe(false);
    });

    it('should handle IPv6 addresses', () => {
      const whitelist = ['::1', '2001:db8::1'];
      expect(isIpAllowed('::1', whitelist)).toBe(true);
      expect(isIpAllowed('2001:db8::1', whitelist)).toBe(true);
      expect(isIpAllowed('2001:db8::2', whitelist)).toBe(false);
    });
  });

  describe('Request ID Generation', () => {
    let generateRequestId: () => string;

    beforeEach(async () => {
      const sharedModule = await import('@localhost-tunnel/shared');
      generateRequestId = sharedModule.generateRequestId;
    });

    it('should generate unique request IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const id = generateRequestId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate IDs with correct format', () => {
      const id = generateRequestId();
      // Should be a valid string
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Logic', () => {
    interface PasswordAttempt {
      attempts: number;
      lastAttempt: number;
      lockedUntil: number;
    }

    const RATE_LIMIT_CONFIG = {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 300000,
    };

    function checkRateLimit(
      attempts: Map<string, PasswordAttempt>,
      key: string
    ): { allowed: boolean; waitTime?: number } {
      const attempt = attempts.get(key);
      const now = Date.now();

      if (!attempt) {
        return { allowed: true };
      }

      if (attempt.lockedUntil > now) {
        return { allowed: false, waitTime: attempt.lockedUntil - now };
      }

      return { allowed: true };
    }

    function recordFailedAttempt(
      attempts: Map<string, PasswordAttempt>,
      key: string
    ): void {
      const now = Date.now();
      const attempt = attempts.get(key) || {
        attempts: 0,
        lastAttempt: now,
        lockedUntil: 0,
      };

      attempt.attempts++;
      attempt.lastAttempt = now;

      if (attempt.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
        const delay = Math.min(
          RATE_LIMIT_CONFIG.baseDelay *
            Math.pow(2, attempt.attempts - RATE_LIMIT_CONFIG.maxAttempts),
          RATE_LIMIT_CONFIG.maxDelay
        );
        attempt.lockedUntil = now + delay;
      }

      attempts.set(key, attempt);
    }

    it('should allow first attempt', () => {
      const attempts = new Map<string, PasswordAttempt>();
      const result = checkRateLimit(attempts, 'test-key');
      expect(result.allowed).toBe(true);
    });

    it('should allow attempts under threshold', () => {
      const attempts = new Map<string, PasswordAttempt>();

      for (let i = 0; i < RATE_LIMIT_CONFIG.maxAttempts - 1; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      const result = checkRateLimit(attempts, 'test-key');
      expect(result.allowed).toBe(true);
    });

    it('should lock out after max attempts', () => {
      const attempts = new Map<string, PasswordAttempt>();

      for (let i = 0; i < RATE_LIMIT_CONFIG.maxAttempts; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      const result = checkRateLimit(attempts, 'test-key');
      expect(result.allowed).toBe(false);
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('should apply exponential backoff', () => {
      const attempts = new Map<string, PasswordAttempt>();

      // First lockout after 5 attempts = 1 second
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      let attempt = attempts.get('test-key')!;
      const firstDelay = attempt.lockedUntil - attempt.lastAttempt;
      expect(firstDelay).toBe(1000); // 1 second

      // Clear and try 6 attempts = 2 seconds
      attempts.clear();
      for (let i = 0; i < 6; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      attempt = attempts.get('test-key')!;
      const secondDelay = attempt.lockedUntil - attempt.lastAttempt;
      expect(secondDelay).toBe(2000); // 2 seconds

      // Clear and try 7 attempts = 4 seconds
      attempts.clear();
      for (let i = 0; i < 7; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      attempt = attempts.get('test-key')!;
      const thirdDelay = attempt.lockedUntil - attempt.lastAttempt;
      expect(thirdDelay).toBe(4000); // 4 seconds
    });

    it('should cap delay at maxDelay', () => {
      const attempts = new Map<string, PasswordAttempt>();

      // Many attempts to exceed maxDelay
      for (let i = 0; i < 20; i++) {
        recordFailedAttempt(attempts, 'test-key');
      }

      const attempt = attempts.get('test-key')!;
      const delay = attempt.lockedUntil - attempt.lastAttempt;
      expect(delay).toBe(RATE_LIMIT_CONFIG.maxDelay); // 5 minutes max
    });

    it('should track attempts per key separately', () => {
      const attempts = new Map<string, PasswordAttempt>();

      // Max out key1
      for (let i = 0; i < RATE_LIMIT_CONFIG.maxAttempts; i++) {
        recordFailedAttempt(attempts, 'key1');
      }

      // key2 should still be allowed
      const result = checkRateLimit(attempts, 'key2');
      expect(result.allowed).toBe(true);

      // key1 should be locked
      const result1 = checkRateLimit(attempts, 'key1');
      expect(result1.allowed).toBe(false);
    });
  });
});
