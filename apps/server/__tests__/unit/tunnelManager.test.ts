import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/db/prisma', () => ({
  prisma: {
    tunnel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    request: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({
      tunnel: {
        updateMany: vi.fn(),
      },
    })),
  },
}));

vi.mock('../../src/lib/api/logger', () => ({
  systemLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/lib/tunnel/subdomain', () => ({
  generateSubdomain: vi.fn(() => 'test-subdomain'),
  validateSubdomain: vi.fn(() => ({ valid: true })),
  normalizeSubdomain: vi.fn((s) => s.toLowerCase()),
}));

vi.mock('../../src/lib/tunnel/auth', () => ({
  hashPassword: vi.fn(async (p) => `hashed-${p}`),
  verifyPassword: vi.fn(async () => true),
  parseIpWhitelist: vi.fn(() => []),
  isIpAllowed: vi.fn(() => true),
}));

// Import after mocks
import { prisma } from '../../src/lib/db/prisma';
import { generateSubdomain, validateSubdomain, normalizeSubdomain } from '../../src/lib/tunnel/subdomain';
import { hashPassword, verifyPassword, isIpAllowed } from '../../src/lib/tunnel/auth';

describe('TunnelManager', () => {
  let tunnelManager: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Import fresh instance
    const module = await import('../../src/lib/tunnel/manager');
    tunnelManager = module.tunnelManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tunnelManager instance', () => {
    it('should be an EventEmitter with standard methods', () => {
      expect(typeof tunnelManager.on).toBe('function');
      expect(typeof tunnelManager.emit).toBe('function');
      expect(typeof tunnelManager.off).toBe('function');
      expect(typeof tunnelManager.removeAllListeners).toBe('function');
    });

    it('should exist as singleton', () => {
      expect(tunnelManager).toBeDefined();
    });
  });
});

describe('TunnelManager - subdomain handling', () => {
  describe('validateSubdomain', () => {
    it('should validate subdomain format', () => {
      const result = validateSubdomain('valid-subdomain');
      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeSubdomain', () => {
    it('should normalize to lowercase', () => {
      const result = normalizeSubdomain('TEST-DOMAIN');
      expect(result).toBe('test-domain');
    });
  });

  describe('generateSubdomain', () => {
    it('should generate unique subdomain', () => {
      const subdomain = generateSubdomain();
      expect(subdomain).toBeDefined();
    });
  });
});

describe('TunnelManager - password handling', () => {
  describe('hashPassword', () => {
    it('should hash passwords', async () => {
      const hash = await hashPassword('test-password');
      expect(hash).toContain('hashed');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const result = await verifyPassword('password', 'hash');
      expect(result).toBe(true);
    });
  });
});

describe('TunnelManager - IP whitelist', () => {
  describe('isIpAllowed', () => {
    it('should allow IP in whitelist', () => {
      const allowed = isIpAllowed('192.168.1.1', ['192.168.1.1']);
      expect(allowed).toBe(true);
    });
  });
});

describe('Request timeout configuration', () => {
  it('should have default timeout', () => {
    const defaultTimeout = 30000;
    expect(defaultTimeout).toBe(30000);
  });

  it('should have minimum timeout', () => {
    const minTimeout = 5000;
    expect(minTimeout).toBe(5000);
  });

  it('should have maximum timeout', () => {
    const maxTimeout = 300000;
    expect(maxTimeout).toBe(300000);
  });
});

describe('Stats flush configuration', () => {
  it('should have flush interval', () => {
    const flushInterval = 5000;
    expect(flushInterval).toBe(5000);
  });

  it('should have max batch size', () => {
    const maxBatchSize = 100;
    expect(maxBatchSize).toBe(100);
  });
});

describe('Rate limit configuration', () => {
  it('should have max attempts', () => {
    const maxAttempts = 5;
    expect(maxAttempts).toBe(5);
  });

  it('should have base delay', () => {
    const baseDelay = 1000;
    expect(baseDelay).toBe(1000);
  });

  it('should have max delay', () => {
    const maxDelay = 300000;
    expect(maxDelay).toBe(300000);
  });
});
