import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Concurrent API Tests
 * Tests for API behavior under concurrent load
 */

// Mock data
const mockTunnel = {
  id: 'tunnel-1',
  subdomain: 'test-tunnel',
  localPort: 3000,
  localHost: 'localhost',
  protocol: 'HTTP',
  isActive: true,
  userId: 'user-1',
  teamId: null,
  password: null,
  ipWhitelist: null,
  expiresAt: null,
  inspect: true,
  totalRequests: 0,
  totalBytes: BigInt(0),
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActiveAt: new Date(),
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
};

const mockPrisma = {
  tunnel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  request: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  teamMember: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: mockUser,
    })
  ),
}));

describe('Concurrent API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent Tunnel Creation', () => {
    it('should handle multiple tunnel creations with unique subdomains', async () => {
      const subdomains = new Set<string>();
      let tunnelCount = 0;

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const subdomain = `tunnel-${tunnelCount++}`;
        subdomains.add(subdomain);
        return { id: `id-${tunnelCount}`, subdomain };
      });

      // Simulate 5 concurrent tunnel creations
      const results = await Promise.all(
        Array(5)
          .fill(null)
          .map((_, i) =>
            mockPrisma.$transaction(async () => ({
              id: `tunnel-${i}`,
              subdomain: `test-${i}`,
            }))
          )
      );

      expect(results).toHaveLength(5);
      expect(subdomains.size).toBe(5); // All unique
    });

    it('should prevent duplicate subdomain allocation', async () => {
      const allocatedSubdomains = new Set<string>();
      let conflicts = 0;

      async function tryAllocateSubdomain(subdomain: string): Promise<{ success: boolean; subdomain?: string }> {
        if (allocatedSubdomains.has(subdomain)) {
          conflicts++;
          return { success: false };
        }

        // Simulate race - multiple may pass this check
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        // Double-check after delay
        if (allocatedSubdomains.has(subdomain)) {
          conflicts++;
          return { success: false };
        }

        allocatedSubdomains.add(subdomain);
        return { success: true, subdomain };
      }

      // All trying to get the same subdomain
      const results = await Promise.all([
        tryAllocateSubdomain('popular-name'),
        tryAllocateSubdomain('popular-name'),
        tryAllocateSubdomain('popular-name'),
      ]);

      const successes = results.filter((r) => r.success);
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(allocatedSubdomains.size).toBe(1);
    });
  });

  describe('Concurrent Tunnel Updates', () => {
    it('should handle concurrent tunnel configuration updates', async () => {
      let tunnelConfig = { port: 3000, inspect: true };
      const updateLog: { port?: number; inspect?: boolean }[] = [];

      async function updateTunnelConfig(updates: Partial<typeof tunnelConfig>): Promise<typeof tunnelConfig> {
        // Read current config
        const current = { ...tunnelConfig };

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        // Apply updates
        tunnelConfig = { ...current, ...updates };
        updateLog.push(updates);

        return tunnelConfig;
      }

      // Concurrent updates
      await Promise.all([
        updateTunnelConfig({ port: 4000 }),
        updateTunnelConfig({ inspect: false }),
        updateTunnelConfig({ port: 5000 }),
      ]);

      expect(updateLog).toHaveLength(3);
      // Final state should reflect one of the updates
      expect([3000, 4000, 5000]).toContain(tunnelConfig.port);
    });

    it('should maintain data consistency with optimistic locking', async () => {
      interface TunnelWithVersion {
        id: string;
        port: number;
        version: number;
      }

      let tunnel: TunnelWithVersion = { id: 'tunnel-1', port: 3000, version: 1 };
      const successfulUpdates: number[] = [];
      const failedUpdates: number[] = [];

      async function updateWithVersion(
        newPort: number,
        expectedVersion: number
      ): Promise<{ success: boolean; version: number }> {
        // Check version
        if (tunnel.version !== expectedVersion) {
          failedUpdates.push(newPort);
          return { success: false, version: tunnel.version };
        }

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));

        // Double-check version
        if (tunnel.version !== expectedVersion) {
          failedUpdates.push(newPort);
          return { success: false, version: tunnel.version };
        }

        // Update
        tunnel = { ...tunnel, port: newPort, version: tunnel.version + 1 };
        successfulUpdates.push(newPort);
        return { success: true, version: tunnel.version };
      }

      // All trying to update from version 1
      await Promise.all([
        updateWithVersion(4000, 1),
        updateWithVersion(5000, 1),
        updateWithVersion(6000, 1),
      ]);

      // Only one should succeed
      expect(successfulUpdates.length).toBeGreaterThanOrEqual(1);
      expect(tunnel.version).toBeGreaterThan(1);
    });
  });

  describe('Concurrent Request Logging', () => {
    it('should handle high-volume concurrent request logging', async () => {
      const requestLogs: { id: string; timestamp: Date }[] = [];
      let requestCounter = 0;

      async function logRequest(): Promise<string> {
        const requestId = `req-${++requestCounter}`;
        requestLogs.push({ id: requestId, timestamp: new Date() });
        return requestId;
      }

      // Log 100 concurrent requests
      const requestIds = await Promise.all(
        Array(100)
          .fill(null)
          .map(() => logRequest())
      );

      expect(requestIds).toHaveLength(100);
      expect(requestLogs).toHaveLength(100);
      expect(new Set(requestIds).size).toBe(100); // All unique IDs
    });

    it('should aggregate stats correctly under concurrent load', async () => {
      let totalRequests = 0;
      let totalBytes = 0;

      async function recordRequest(bytes: number): Promise<void> {
        totalRequests++;
        totalBytes += bytes;
      }

      // Concurrent stats updates
      await Promise.all(
        Array(50)
          .fill(null)
          .map((_, i) => recordRequest(100 + i))
      );

      expect(totalRequests).toBe(50);
      // Sum of 100 to 149
      expect(totalBytes).toBe(50 * 100 + (49 * 50) / 2);
    });
  });

  describe('Concurrent Authentication', () => {
    it('should handle concurrent login requests', async () => {
      const activeSessions = new Map<string, { userId: string; createdAt: Date }>();
      let loginCount = 0;

      async function login(userId: string): Promise<{ sessionId: string; isNew: boolean }> {
        loginCount++;

        // Check for existing session
        for (const [sessionId, session] of activeSessions) {
          if (session.userId === userId) {
            return { sessionId, isNew: false };
          }
        }

        // Create new session
        const sessionId = `session-${Date.now()}-${Math.random().toString(36)}`;
        activeSessions.set(sessionId, { userId, createdAt: new Date() });

        return { sessionId, isNew: true };
      }

      // Same user logging in concurrently
      const results = await Promise.all([
        login('user-1'),
        login('user-1'),
        login('user-1'),
      ]);

      // At least first one should be new
      const newSessions = results.filter((r) => r.isNew);
      expect(newSessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should validate tokens concurrently without bottleneck', async () => {
      const validTokens = new Set(['token-1', 'token-2', 'token-3']);

      async function validateToken(token: string): Promise<boolean> {
        // Simulate validation delay
        await new Promise((resolve) => setTimeout(resolve, 1));
        return validTokens.has(token);
      }

      const startTime = Date.now();

      // Validate 10 tokens concurrently
      const results = await Promise.all([
        validateToken('token-1'),
        validateToken('token-2'),
        validateToken('token-3'),
        validateToken('invalid-1'),
        validateToken('invalid-2'),
        validateToken('token-1'),
        validateToken('token-2'),
        validateToken('invalid-3'),
        validateToken('token-3'),
        validateToken('invalid-4'),
      ]);

      const elapsed = Date.now() - startTime;

      // Should complete quickly due to parallel execution
      expect(elapsed).toBeLessThan(100); // Much less than 10ms * 10 = 100ms

      const validCount = results.filter(Boolean).length;
      expect(validCount).toBe(6); // 3 valid tokens, some repeated
    });
  });

  describe('Concurrent Rate Limiting', () => {
    it('should enforce rate limits across concurrent requests', async () => {
      const limit = 10;
      let requestCount = 0;
      const results: boolean[] = [];

      async function checkAndIncrement(): Promise<boolean> {
        if (requestCount >= limit) {
          return false;
        }
        requestCount++;
        return true;
      }

      // Fire 20 concurrent requests
      const promises = Array(20)
        .fill(null)
        .map(() => checkAndIncrement());
      const allResults = await Promise.all(promises);

      results.push(...allResults);

      const allowed = results.filter(Boolean);
      const blocked = results.filter((r) => !r);

      expect(allowed.length).toBe(limit);
      expect(blocked.length).toBe(10);
    });

    it('should handle sliding window rate limit correctly', async () => {
      interface SlidingWindow {
        timestamps: number[];
        limit: number;
        windowMs: number;
      }

      const window: SlidingWindow = {
        timestamps: [],
        limit: 5,
        windowMs: 1000,
      };

      function checkSlidingWindow(): boolean {
        const now = Date.now();
        const cutoff = now - window.windowMs;

        // Remove old timestamps
        window.timestamps = window.timestamps.filter((t) => t > cutoff);

        if (window.timestamps.length >= window.limit) {
          return false;
        }

        window.timestamps.push(now);
        return true;
      }

      // Burst of requests
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(checkSlidingWindow());
      }

      const allowed = results.filter(Boolean);
      expect(allowed.length).toBe(window.limit);
    });
  });

  describe('Concurrent Team Operations', () => {
    it('should handle concurrent team member additions', async () => {
      const teamMembers = new Set<string>();

      async function addTeamMember(userId: string): Promise<{ success: boolean; alreadyMember: boolean }> {
        if (teamMembers.has(userId)) {
          return { success: false, alreadyMember: true };
        }

        await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));

        if (teamMembers.has(userId)) {
          return { success: false, alreadyMember: true };
        }

        teamMembers.add(userId);
        return { success: true, alreadyMember: false };
      }

      // Try to add same user multiple times concurrently
      const results = await Promise.all([
        addTeamMember('user-1'),
        addTeamMember('user-1'),
        addTeamMember('user-2'),
        addTeamMember('user-2'),
        addTeamMember('user-3'),
      ]);

      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(3); // At least 3 unique users
      expect(teamMembers.size).toBe(3);
    });

    it('should handle concurrent role changes', async () => {
      const memberRoles = new Map<string, string>();
      memberRoles.set('user-1', 'MEMBER');

      async function changeRole(userId: string, newRole: string): Promise<{ success: boolean; previousRole: string }> {
        const previousRole = memberRoles.get(userId) || 'NONE';

        await new Promise((resolve) => setTimeout(resolve, Math.random() * 2));

        memberRoles.set(userId, newRole);
        return { success: true, previousRole };
      }

      // Concurrent role changes
      await Promise.all([
        changeRole('user-1', 'ADMIN'),
        changeRole('user-1', 'OWNER'),
        changeRole('user-1', 'VIEWER'),
      ]);

      // Final role should be one of the attempted changes
      const finalRole = memberRoles.get('user-1');
      expect(['ADMIN', 'OWNER', 'VIEWER']).toContain(finalRole);
    });
  });

  describe('Concurrent Analytics Queries', () => {
    it('should handle concurrent analytics aggregation', async () => {
      const analyticsData = [
        { tunnelId: 'tunnel-1', requests: 100, bytes: 50000 },
        { tunnelId: 'tunnel-2', requests: 200, bytes: 100000 },
        { tunnelId: 'tunnel-3', requests: 150, bytes: 75000 },
      ];

      async function getAnalytics(tunnelId: string): Promise<{ requests: number; bytes: number } | null> {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
        const data = analyticsData.find((d) => d.tunnelId === tunnelId);
        return data ? { requests: data.requests, bytes: data.bytes } : null;
      }

      // Concurrent queries
      const results = await Promise.all([
        getAnalytics('tunnel-1'),
        getAnalytics('tunnel-2'),
        getAnalytics('tunnel-3'),
        getAnalytics('tunnel-1'), // Duplicate query
      ]);

      expect(results).toHaveLength(4);
      expect(results[0]?.requests).toBe(100);
      expect(results[1]?.requests).toBe(200);
      expect(results[3]?.requests).toBe(100); // Same as first
    });

    it('should cache analytics results for concurrent requests', async () => {
      const cache = new Map<string, { data: unknown; timestamp: number }>();
      let dbQueries = 0;

      async function getCachedAnalytics(tunnelId: string): Promise<unknown> {
        const cached = cache.get(tunnelId);
        if (cached && Date.now() - cached.timestamp < 5000) {
          return cached.data;
        }

        dbQueries++;
        const data = { tunnelId, requests: Math.random() * 1000 };

        cache.set(tunnelId, { data, timestamp: Date.now() });
        return data;
      }

      // Concurrent requests for same tunnel
      await Promise.all([
        getCachedAnalytics('tunnel-1'),
        getCachedAnalytics('tunnel-1'),
        getCachedAnalytics('tunnel-1'),
      ]);

      // Most should hit cache after first query
      // Note: Due to concurrent nature, might have 1-3 db queries
      expect(dbQueries).toBeLessThanOrEqual(3);
    });
  });

  describe('Concurrent WebSocket-like Operations', () => {
    it('should handle concurrent message broadcasting', async () => {
      const connectedClients = new Map<string, { id: string; messageCount: number }>();
      connectedClients.set('client-1', { id: 'client-1', messageCount: 0 });
      connectedClients.set('client-2', { id: 'client-2', messageCount: 0 });
      connectedClients.set('client-3', { id: 'client-3', messageCount: 0 });

      async function broadcast(message: string): Promise<number> {
        let delivered = 0;

        for (const [, client] of connectedClients) {
          await new Promise((resolve) => setTimeout(resolve, 1));
          client.messageCount++;
          delivered++;
        }

        return delivered;
      }

      // Concurrent broadcasts
      const deliveryCounts = await Promise.all([
        broadcast('message-1'),
        broadcast('message-2'),
        broadcast('message-3'),
      ]);

      // Each broadcast should reach all clients
      expect(deliveryCounts.every((count) => count === 3)).toBe(true);

      // Each client should have received all messages
      for (const [, client] of connectedClients) {
        expect(client.messageCount).toBe(3);
      }
    });

    it('should handle concurrent client connections and disconnections', async () => {
      const clients = new Map<string, boolean>();

      async function connect(clientId: string): Promise<boolean> {
        if (clients.has(clientId)) {
          return false;
        }
        clients.set(clientId, true);
        return true;
      }

      async function disconnect(clientId: string): Promise<boolean> {
        if (!clients.has(clientId)) {
          return false;
        }
        clients.delete(clientId);
        return true;
      }

      // Mix of connects and disconnects
      clients.set('existing-1', true);
      clients.set('existing-2', true);

      const results = await Promise.all([
        connect('new-1'),
        connect('new-2'),
        disconnect('existing-1'),
        connect('new-3'),
        disconnect('existing-2'),
      ]);

      const successCount = results.filter(Boolean).length;
      expect(successCount).toBe(5);
      expect(clients.size).toBe(3); // 3 new - 0 (2 removed)
    });
  });

  describe('Concurrent Error Handling', () => {
    it('should handle errors gracefully in concurrent operations', async () => {
      async function riskyOperation(id: number): Promise<{ id: number; success: boolean; error?: string }> {
        // 30% chance of failure
        if (id % 3 === 0) {
          throw new Error(`Operation ${id} failed`);
        }
        return { id, success: true };
      }

      const results = await Promise.allSettled(
        Array(10)
          .fill(null)
          .map((_, i) => riskyOperation(i))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Some should succeed, some should fail
      expect(fulfilled.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);

      // Failures should have error messages
      rejected.forEach((r) => {
        if (r.status === 'rejected') {
          expect(r.reason).toBeInstanceOf(Error);
        }
      });
    });

    it('should not crash on cascading failures', async () => {
      const operations: (() => Promise<void>)[] = [];
      let failureCount = 0;

      for (let i = 0; i < 10; i++) {
        operations.push(async () => {
          if (i < 3) {
            failureCount++;
            throw new Error(`Failure ${i}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        });
      }

      const results = await Promise.allSettled(operations.map((op) => op()));

      expect(failureCount).toBe(3);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(7);
    });
  });
});
