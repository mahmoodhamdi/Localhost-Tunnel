import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma before importing the function
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { authenticateApiKey } from '@/lib/api/withApiKey';
import { prisma } from '@/lib/db/prisma';

describe('API Key Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Header validation', () => {
    it('should return null when no X-API-Key header', async () => {
      const request = new Request('http://localhost:3000/api/test');
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should return null for empty X-API-Key header', async () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': '' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should extract X-API-Key from headers', async () => {
      const mockApiKey = {
        id: 'key1',
        key: 'test-key-123',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test User',
          image: null,
          role: 'USER',
        },
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'test-key-123' },
      });

      await authenticateApiKey(request);

      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'test-key-123',
          isActive: true,
        },
        include: { user: true },
      });
    });
  });

  describe('Invalid API key', () => {
    it('should return null for invalid API key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'invalid-key' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should return null for inactive API key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'inactive-key' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should not query database when no header present', async () => {
      const request = new Request('http://localhost:3000/api/test');
      await authenticateApiKey(request);
      expect(prisma.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'some-key' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });
  });

  describe('Expired API key', () => {
    it('should return null for expired API key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should return null for key expiring right now', async () => {
      const now = new Date();
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: now, // Expires now
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it('should accept key expiring 1 millisecond from now (boundary)', async () => {
      const almostExpired = new Date(Date.now() + 1);
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: almostExpired,
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      // This should still return the user since it's in the future
      const result = await authenticateApiKey(request);
      expect(result).not.toBeNull();
    });
  });

  describe('Valid API key', () => {
    it('should return user for valid API key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user1');
      expect(result!.email).toBe('test@test.com');
      expect(result!.name).toBe('Test');
      expect(result!.role).toBe('USER');
    });

    it('should return user for key with no expiration', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: null, // no expiration
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user1');
    });

    it('should return user for admin role', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'admin-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'admin1',
          email: 'admin@test.com',
          name: 'Admin User',
          image: null,
          role: 'ADMIN',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'admin-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result!.role).toBe('ADMIN');
    });
  });

  describe('Last used timestamp update', () => {
    it('should update lastUsedAt on successful authentication', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      await authenticateApiKey(request);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key1' },
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should handle update failure silently (fire-and-forget)', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Update failed')
      );

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });

      // Should not throw despite update failure
      const result = await authenticateApiKey(request);
      expect(result).not.toBeNull();
    });

    it('should not update for invalid key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'invalid-key' },
      });
      await authenticateApiKey(request);

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should not update for expired key', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'expired-key',
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'expired-key' },
      });
      await authenticateApiKey(request);

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  describe('User information returned', () => {
    it('should return all user fields', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'john@example.com',
        name: 'John Doe',
        image: 'https://example.com/avatar.jpg',
        role: 'USER',
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result).toEqual({
        id: 'user-uuid-123',
        email: 'john@example.com',
        name: 'John Doe',
        image: 'https://example.com/avatar.jpg',
        role: 'USER',
      });
    });

    it('should handle null image field', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result!.image).toBeNull();
    });

    it('should handle null name field', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: null,
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const result = await authenticateApiKey(request);

      expect(result!.name).toBeNull();
    });
  });

  describe('Multiple requests with same key', () => {
    it('should update lastUsedAt on each request', async () => {
      const apiKeyData = {
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(apiKeyData);
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request1 = new Request('http://localhost:3000/api/test1', {
        headers: { 'X-API-Key': 'valid-key' },
      });
      const request2 = new Request('http://localhost:3000/api/test2', {
        headers: { 'X-API-Key': 'valid-key' },
      });

      await authenticateApiKey(request1);
      await authenticateApiKey(request2);

      // Should be called twice
      expect(prisma.apiKey.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Case sensitivity', () => {
    it('should treat X-API-Key header case-insensitively', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key1',
        key: 'valid-key',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user1',
          email: 'test@test.com',
          name: 'Test',
          image: null,
          role: 'USER',
        },
      });
      (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      // Request headers are case-insensitive
      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-api-key': 'valid-key' }, // lowercase
      });
      const result = await authenticateApiKey(request);

      // Should still authenticate
      expect(result).not.toBeNull();
    });
  });
});
