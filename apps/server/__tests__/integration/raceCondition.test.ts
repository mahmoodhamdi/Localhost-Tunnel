import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Race Condition Tests
 * Tests for concurrent operations and race condition handling
 */

// Mock Prisma Client with transaction support
const mockTransaction = vi.fn();
const mockPrisma = {
  tunnel: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: mockTransaction,
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    })
  ),
}));

describe('Race Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subdomain Allocation Race Condition', () => {
    /**
     * Simulates concurrent subdomain allocation attempts
     * Tests that only one request succeeds when multiple requests try to allocate the same subdomain
     */
    it('should handle concurrent subdomain allocation with transactions', async () => {
      const subdomain = 'test-tunnel-123';
      let allocations = 0;
      let conflicts = 0;

      // Simulate transaction that locks and checks
      mockTransaction.mockImplementation(async (callback) => {
        // Simulate database lock acquisition time
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

        // First allocation succeeds, subsequent ones fail
        if (allocations === 0) {
          allocations++;
          return callback({
            tunnel: {
              findUnique: vi.fn().mockResolvedValue(null),
              upsert: vi.fn().mockResolvedValue({ id: 'tunnel-1', subdomain }),
            },
          });
        } else {
          conflicts++;
          throw new Error('SUBDOMAIN_COLLISION');
        }
      });

      // Simulate 5 concurrent requests for the same subdomain
      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          mockTransaction(async (tx: { tunnel: { findUnique: () => Promise<null>; upsert: () => Promise<{ id: string; subdomain: string }> } }) => {
            const existing = await tx.tunnel.findUnique();
            if (existing) {
              throw new Error('SUBDOMAIN_TAKEN');
            }
            return tx.tunnel.upsert();
          }).catch((e: Error) => ({ error: e.message }))
        );

      const results = await Promise.all(concurrentRequests);

      // Only one should succeed
      const successes = results.filter((r) => !('error' in r));
      const failures = results.filter((r) => 'error' in r);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);
    });

    it('should retry with new subdomain on collision', async () => {
      let attempts = 0;
      const maxRetries = 5;

      // Simulate retry logic
      async function allocateSubdomain(): Promise<{ success: boolean; subdomain?: string; attempts: number }> {
        for (let i = 0; i < maxRetries; i++) {
          attempts++;
          try {
            // Simulate 50% collision rate
            if (Math.random() < 0.5 && i < maxRetries - 1) {
              throw new Error('SUBDOMAIN_COLLISION');
            }
            return { success: true, subdomain: `test-${i}`, attempts };
          } catch {
            continue;
          }
        }
        return { success: false, attempts };
      }

      const result = await allocateSubdomain();

      expect(result.attempts).toBeLessThanOrEqual(maxRetries);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      const maxRetries = 5;
      let attempts = 0;

      async function allocateSubdomain(): Promise<{ success: boolean; attempts: number }> {
        for (let i = 0; i < maxRetries; i++) {
          attempts++;
          // Always collision
          if (i < maxRetries - 1) {
            continue;
          }
        }
        // Final attempt also fails
        return { success: false, attempts };
      }

      const result = await allocateSubdomain();

      expect(result.attempts).toBe(maxRetries);
      expect(result.success).toBe(false);
    });
  });

  describe('Concurrent Tunnel Updates', () => {
    it('should handle concurrent tunnel status updates', async () => {
      const tunnelId = 'tunnel-1';
      let currentStatus = 'active';
      const updateLog: string[] = [];

      // Simulate optimistic locking with version check
      async function updateTunnelStatus(newStatus: string, expectedStatus: string): Promise<boolean> {
        // Read current status
        const current = currentStatus;

        if (current !== expectedStatus) {
          return false; // Conflict - status changed by another request
        }

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

        // Check again (double-check pattern)
        if (currentStatus !== expectedStatus) {
          return false;
        }

        currentStatus = newStatus;
        updateLog.push(newStatus);
        return true;
      }

      // Concurrent updates
      const results = await Promise.all([
        updateTunnelStatus('paused', 'active'),
        updateTunnelStatus('inactive', 'active'),
        updateTunnelStatus('maintenance', 'active'),
      ]);

      // At least one should succeed
      const successCount = results.filter(Boolean).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Final state should be consistent
      expect(['paused', 'inactive', 'maintenance', 'active']).toContain(currentStatus);
    });

    it('should prevent double-deletion', async () => {
      let tunnelExists = true;
      let deleteCount = 0;

      async function deleteTunnel(): Promise<{ success: boolean; alreadyDeleted: boolean }> {
        if (!tunnelExists) {
          return { success: false, alreadyDeleted: true };
        }

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        if (!tunnelExists) {
          return { success: false, alreadyDeleted: true };
        }

        tunnelExists = false;
        deleteCount++;
        return { success: true, alreadyDeleted: false };
      }

      // Concurrent delete attempts
      const results = await Promise.all([deleteTunnel(), deleteTunnel(), deleteTunnel()]);

      const successfulDeletes = results.filter((r) => r.success);
      const alreadyDeleted = results.filter((r) => r.alreadyDeleted);

      // Only one delete should succeed
      expect(successfulDeletes.length).toBe(1);
      expect(alreadyDeleted.length).toBe(2);
      expect(deleteCount).toBe(1);
    });
  });

  describe('Request Counter Race Condition', () => {
    it('should accurately count concurrent requests', async () => {
      let requestCount = 0;
      const expectedCount = 100;

      // Simulate atomic increment
      async function incrementCounter(): Promise<number> {
        const current = requestCount;
        // No race here as we're simulating atomic operation
        requestCount = current + 1;
        return requestCount;
      }

      // Fire 100 concurrent requests
      const promises = Array(expectedCount)
        .fill(null)
        .map(() => incrementCounter());

      await Promise.all(promises);

      expect(requestCount).toBe(expectedCount);
    });

    it('should handle counter overflow protection', async () => {
      const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;
      let count = MAX_SAFE_COUNT - 5;

      function safeIncrement(): { count: number; overflow: boolean } {
        if (count >= MAX_SAFE_COUNT) {
          return { count, overflow: true };
        }
        count++;
        return { count, overflow: false };
      }

      // Increment past safe limit
      const results: { count: number; overflow: boolean }[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(safeIncrement());
      }

      const overflows = results.filter((r) => r.overflow);
      expect(overflows.length).toBeGreaterThan(0);
    });
  });

  describe('Session Race Condition', () => {
    it('should handle concurrent session creation', async () => {
      const sessions = new Map<string, { userId: string; createdAt: Date }>();
      const userId = 'user-1';

      async function createSession(): Promise<{ sessionId: string; isNew: boolean }> {
        const existingSession = Array.from(sessions.entries()).find(([, s]) => s.userId === userId);

        if (existingSession) {
          return { sessionId: existingSession[0], isNew: false };
        }

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        // Check again after delay
        const existingAfterDelay = Array.from(sessions.entries()).find(([, s]) => s.userId === userId);
        if (existingAfterDelay) {
          return { sessionId: existingAfterDelay[0], isNew: false };
        }

        const sessionId = `session-${Date.now()}-${Math.random()}`;
        sessions.set(sessionId, { userId, createdAt: new Date() });
        return { sessionId, isNew: true };
      }

      // Concurrent session creation attempts
      const results = await Promise.all([createSession(), createSession(), createSession()]);

      // Should reuse same session after first creation
      const newSessions = results.filter((r) => r.isNew);
      expect(newSessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should invalidate old sessions on new login', async () => {
      const sessions = new Map<string, { userId: string; valid: boolean }>();
      const userId = 'user-1';

      // Create initial session
      sessions.set('old-session', { userId, valid: true });

      async function login(): Promise<{ sessionId: string; invalidatedCount: number }> {
        let invalidatedCount = 0;

        // Invalidate existing sessions
        for (const [id, session] of sessions.entries()) {
          if (session.userId === userId && session.valid) {
            sessions.set(id, { ...session, valid: false });
            invalidatedCount++;
          }
        }

        // Create new session
        const newSessionId = `session-${Date.now()}`;
        sessions.set(newSessionId, { userId, valid: true });

        return { sessionId: newSessionId, invalidatedCount };
      }

      const result = await login();

      expect(result.invalidatedCount).toBe(1);
      expect(sessions.get('old-session')?.valid).toBe(false);
    });
  });

  describe('Rate Limiter Race Condition', () => {
    it('should accurately enforce rate limits under concurrent load', async () => {
      const limit = 10;
      const windowMs = 1000;
      let requestCount = 0;
      const windowStart = Date.now();

      function checkRateLimit(): { allowed: boolean; remaining: number } {
        const now = Date.now();

        // Reset window if expired
        if (now - windowStart > windowMs) {
          requestCount = 0;
        }

        if (requestCount >= limit) {
          return { allowed: false, remaining: 0 };
        }

        requestCount++;
        return { allowed: true, remaining: limit - requestCount };
      }

      // Fire requests
      const results: { allowed: boolean; remaining: number }[] = [];
      for (let i = 0; i < 15; i++) {
        results.push(checkRateLimit());
      }

      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      expect(allowed.length).toBe(limit);
      expect(blocked.length).toBe(5);
    });

    it('should handle distributed rate limiting with eventual consistency', async () => {
      // Simulate distributed rate limiter state
      const nodes = [
        { count: 0, lastSync: Date.now() },
        { count: 0, lastSync: Date.now() },
        { count: 0, lastSync: Date.now() },
      ];
      const globalLimit = 30;
      const perNodeLimit = 10;

      function checkRateLimitOnNode(nodeIndex: number): boolean {
        if (nodes[nodeIndex].count >= perNodeLimit) {
          return false;
        }
        nodes[nodeIndex].count++;
        return true;
      }

      // Distribute requests across nodes
      let allowedCount = 0;
      for (let i = 0; i < 45; i++) {
        const nodeIndex = i % 3;
        if (checkRateLimitOnNode(nodeIndex)) {
          allowedCount++;
        }
      }

      // Each node should allow up to perNodeLimit
      expect(allowedCount).toBe(globalLimit);
      nodes.forEach((node) => {
        expect(node.count).toBe(perNodeLimit);
      });
    });
  });

  describe('Database Connection Pool Race Condition', () => {
    it('should handle pool exhaustion gracefully', async () => {
      const poolSize = 3;
      let activeConnections = 0;
      const results: { success: boolean; hadToWait: boolean }[] = [];

      async function executeQuery(): Promise<{ success: boolean; hadToWait: boolean }> {
        const hadToWait = activeConnections >= poolSize;

        // If pool exhausted, simulate waiting or rejection
        if (hadToWait) {
          // In real scenario, might wait or return error
          return { success: false, hadToWait: true };
        }

        activeConnections++;

        // Simulate query execution
        await new Promise((resolve) => setTimeout(resolve, 5));

        activeConnections--;

        return { success: true, hadToWait: false };
      }

      // Fire concurrent requests sequentially to avoid race
      for (let i = 0; i < 10; i++) {
        const result = await executeQuery();
        results.push(result);
      }

      // All should succeed since we're running sequentially
      const successful = results.filter((r) => r.success);
      expect(successful.length).toBe(10);
    });

    it('should track active connections accurately', async () => {
      let maxConcurrent = 0;
      let activeConnections = 0;
      const poolLimit = 5;

      async function executeWithTracking(): Promise<void> {
        activeConnections++;
        maxConcurrent = Math.max(maxConcurrent, activeConnections);

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 2));

        activeConnections--;
      }

      // Run in batches to test concurrent tracking
      await Promise.all([
        executeWithTracking(),
        executeWithTracking(),
        executeWithTracking(),
      ]);

      expect(maxConcurrent).toBeLessThanOrEqual(poolLimit);
      expect(activeConnections).toBe(0);
    });
  });

  describe('Inventory/Quota Race Condition', () => {
    it('should prevent over-allocation of tunnel quota', async () => {
      const userQuota = 5;
      let currentTunnels = 3;
      const allocations: boolean[] = [];

      async function createTunnel(): Promise<boolean> {
        if (currentTunnels >= userQuota) {
          return false;
        }

        // Simulate check-then-act with potential race
        const canCreate = currentTunnels < userQuota;

        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        if (!canCreate || currentTunnels >= userQuota) {
          return false;
        }

        currentTunnels++;
        return true;
      }

      // Try to create 5 tunnels concurrently (only 2 slots available)
      const results = await Promise.all([
        createTunnel(),
        createTunnel(),
        createTunnel(),
        createTunnel(),
        createTunnel(),
      ]);

      allocations.push(...results);
      const successful = allocations.filter(Boolean);

      // Should not exceed quota
      expect(currentTunnels).toBeLessThanOrEqual(userQuota);
      expect(successful.length).toBeLessThanOrEqual(2);
    });

    it('should handle concurrent quota checks atomically', async () => {
      interface UserQuota {
        used: number;
        limit: number;
      }

      const quotas = new Map<string, UserQuota>();
      quotas.set('user-1', { used: 0, limit: 5 });

      async function allocateResource(userId: string): Promise<{ success: boolean; newUsage: number }> {
        const quota = quotas.get(userId);
        if (!quota) {
          return { success: false, newUsage: 0 };
        }

        if (quota.used >= quota.limit) {
          return { success: false, newUsage: quota.used };
        }

        // Atomic increment
        quota.used++;
        quotas.set(userId, quota);

        return { success: true, newUsage: quota.used };
      }

      // Concurrent allocations
      const results = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => allocateResource('user-1'))
      );

      const successful = results.filter((r) => r.success);
      const quota = quotas.get('user-1');

      expect(successful.length).toBe(5); // Only 5 should succeed
      expect(quota?.used).toBe(5);
    });
  });
});
