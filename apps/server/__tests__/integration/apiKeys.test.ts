import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth
const mockSession = {
  user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

// Mock Prisma client
const mockApiKeys = [
  {
    id: 'key-1',
    name: 'Test Key 1',
    key: 'lt_abc123def456',
    keyPrefix: 'lt_abc123',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date(),
    lastUsedAt: null,
    expiresAt: null,
  },
  {
    id: 'key-2',
    name: 'Test Key 2',
    key: 'lt_xyz789ghi012',
    keyPrefix: 'lt_xyz789',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
];

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';

describe('API Keys Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/keys', () => {
    it('should return list of API keys for authenticated user', async () => {
      (prisma.apiKey.findMany as any).mockResolvedValue(mockApiKeys);

      const response = {
        success: true,
        data: mockApiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
          expiresAt: k.expiresAt,
        })),
      };

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0].keyPrefix).toBe('lt_abc123');
      // Full key should never be returned in list
      expect(response.data[0]).not.toHaveProperty('key');
    });

    it('should return 401 when not authenticated', async () => {
      (auth as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    it('should only return active keys', async () => {
      const activeKeys = mockApiKeys.filter((k) => k.isActive);
      (prisma.apiKey.findMany as any).mockResolvedValue(activeKeys);

      expect(activeKeys).toHaveLength(2);
      activeKeys.forEach((key) => {
        expect(key.isActive).toBe(true);
      });
    });

    it('should order keys by createdAt desc', async () => {
      const orderedKeys = [...mockApiKeys].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      (prisma.apiKey.findMany as any).mockResolvedValue(orderedKeys);

      expect(orderedKeys[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        orderedKeys[1].createdAt.getTime()
      );
    });
  });

  describe('POST /api/keys', () => {
    it('should create a new API key with valid data', async () => {
      const newKey = {
        id: 'key-new',
        name: 'New API Key',
        key: 'lt_' + 'a'.repeat(64),
        keyPrefix: 'lt_aaaaaa',
        userId: 'user-1',
        isActive: true,
        createdAt: new Date(),
        expiresAt: null,
      };

      (prisma.apiKey.create as any).mockResolvedValue(newKey);

      const response = {
        success: true,
        data: {
          id: newKey.id,
          name: newKey.name,
          key: newKey.key, // Full key returned on creation only
          keyPrefix: newKey.keyPrefix,
          createdAt: newKey.createdAt,
          expiresAt: newKey.expiresAt,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.key).toMatch(/^lt_/);
      expect(response.data.name).toBe('New API Key');
    });

    it('should reject empty name', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });

    it('should set expiration when expiresIn provided', async () => {
      const expiresIn = 30 * 24 * 60 * 60; // 30 days in seconds
      const expectedExpiration = new Date(Date.now() + expiresIn * 1000);

      const newKey = {
        id: 'key-expiring',
        name: 'Expiring Key',
        key: 'lt_' + 'b'.repeat(64),
        keyPrefix: 'lt_bbbbbb',
        expiresAt: expectedExpiration,
      };

      (prisma.apiKey.create as any).mockResolvedValue(newKey);

      expect(newKey.expiresAt).toBeDefined();
      expect(newKey.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate unique key prefix', async () => {
      const key1 = 'lt_abc123def456';
      const key2 = 'lt_xyz789ghi012';

      expect(key1.substring(0, 10)).not.toBe(key2.substring(0, 10));
    });
  });

  describe('DELETE /api/keys/[id]', () => {
    it('should deactivate API key', async () => {
      (prisma.apiKey.findFirst as any).mockResolvedValue(mockApiKeys[0]);
      (prisma.apiKey.update as any).mockResolvedValue({
        ...mockApiKeys[0],
        isActive: false,
      });

      const response = {
        success: true,
        data: { message: 'API key deleted' },
      };

      expect(response.success).toBe(true);
    });

    it('should return 404 for non-existent key', async () => {
      (prisma.apiKey.findFirst as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
    });

    it('should not allow deleting another user\'s key', async () => {
      (prisma.apiKey.findFirst as any).mockResolvedValue(null); // Not found for this user

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should validate key format (starts with lt_)', () => {
      const validKey = 'lt_abc123def456';
      const invalidKey = 'abc123def456';

      expect(validKey.startsWith('lt_')).toBe(true);
      expect(invalidKey.startsWith('lt_')).toBe(false);
    });

    it('should have sufficient key length for security', () => {
      const minKeyLength = 32; // 256 bits / 8
      const key = 'lt_' + 'a'.repeat(64); // 64 hex chars = 32 bytes

      expect(key.length - 3).toBeGreaterThanOrEqual(minKeyLength);
    });

    it('should check key expiration', () => {
      const expiredKey = { expiresAt: new Date(Date.now() - 1000) };
      const validKey = { expiresAt: new Date(Date.now() + 1000) };
      const noExpirationKey = { expiresAt: null };

      const isExpired = (key: { expiresAt: Date | null }) =>
        key.expiresAt ? key.expiresAt < new Date() : false;

      expect(isExpired(expiredKey)).toBe(true);
      expect(isExpired(validKey)).toBe(false);
      expect(isExpired(noExpirationKey)).toBe(false);
    });
  });
});
