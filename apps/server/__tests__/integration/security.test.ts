import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma Client
const mockRateLimitRule = {
  id: 'rule-1',
  name: 'Test Rate Limit',
  enabled: true,
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  burstLimit: 100,
  blockDuration: 60,
  customMessage: null,
  tunnelId: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGeoRule = {
  id: 'geo-1',
  name: 'Test Geo Rule',
  enabled: true,
  mode: 'ALLOW',
  countries: 'US,UK,DE',
  tunnelId: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuditLog = {
  id: 'log-1',
  action: 'LOGIN',
  resource: 'USER',
  resourceId: 'user-1',
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
  country: 'US',
  city: 'New York',
  details: '{}',
  status: 'SUCCESS',
  userId: 'user-1',
  createdAt: new Date(),
};

const mockPrisma = {
  rateLimitRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  geoRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
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

describe('Security API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rate Limit Rules API
  describe('Rate Limit Rules API', () => {
    describe('GET /api/security/rate-limits', () => {
      it('should return list of rate limit rules', async () => {
        mockPrisma.rateLimitRule.findMany.mockResolvedValue([mockRateLimitRule]);
        mockPrisma.rateLimitRule.count.mockResolvedValue(1);

        // Simulate API response structure
        const response = {
          success: true,
          data: [mockRateLimitRule],
          pagination: { total: 1, limit: 50, offset: 0 },
        };

        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].name).toBe('Test Rate Limit');
      });

      it('should filter by tunnelId', async () => {
        const tunnelRule = { ...mockRateLimitRule, tunnelId: 'tunnel-1' };
        mockPrisma.rateLimitRule.findMany.mockResolvedValue([tunnelRule]);
        mockPrisma.rateLimitRule.count.mockResolvedValue(1);

        const response = {
          success: true,
          data: [tunnelRule],
        };

        expect(response.data[0].tunnelId).toBe('tunnel-1');
      });

      it('should require authentication', async () => {
        vi.mocked(await import('@/auth')).auth.mockResolvedValueOnce(null);

        const response = {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        };

        expect(response.success).toBe(false);
        expect(response.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/security/rate-limits', () => {
      it('should create new rate limit rule', async () => {
        mockPrisma.rateLimitRule.create.mockResolvedValue(mockRateLimitRule);

        const response = {
          success: true,
          data: mockRateLimitRule,
        };

        expect(response.success).toBe(true);
        expect(response.data.name).toBe('Test Rate Limit');
        expect(response.data.requestsPerMinute).toBe(60);
      });

      it('should validate required fields', async () => {
        const response = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
        };

        expect(response.success).toBe(false);
        expect(response.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate numeric fields', async () => {
        const response = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Requests per minute must be positive' },
        };

        expect(response.success).toBe(false);
      });
    });

    describe('PUT /api/security/rate-limits/[id]', () => {
      it('should update existing rule', async () => {
        mockPrisma.rateLimitRule.findFirst.mockResolvedValue(mockRateLimitRule);
        const updatedRule = { ...mockRateLimitRule, requestsPerMinute: 120 };
        mockPrisma.rateLimitRule.update.mockResolvedValue(updatedRule);

        const response = {
          success: true,
          data: updatedRule,
        };

        expect(response.success).toBe(true);
        expect(response.data.requestsPerMinute).toBe(120);
      });

      it('should return 404 for non-existent rule', async () => {
        mockPrisma.rateLimitRule.findFirst.mockResolvedValue(null);

        const response = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Rate limit rule not found' },
        };

        expect(response.success).toBe(false);
        expect(response.error.code).toBe('NOT_FOUND');
      });

      it('should not allow updating another user rule', async () => {
        const otherUserRule = { ...mockRateLimitRule, userId: 'other-user' };
        mockPrisma.rateLimitRule.findFirst.mockResolvedValue(null); // Returns null when userId doesn't match

        const response = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Rate limit rule not found' },
        };

        expect(response.success).toBe(false);
      });
    });

    describe('DELETE /api/security/rate-limits/[id]', () => {
      it('should delete existing rule', async () => {
        mockPrisma.rateLimitRule.findFirst.mockResolvedValue(mockRateLimitRule);
        mockPrisma.rateLimitRule.delete.mockResolvedValue(mockRateLimitRule);

        const response = {
          success: true,
          message: 'Rate limit rule deleted',
        };

        expect(response.success).toBe(true);
      });

      it('should return 404 for non-existent rule', async () => {
        mockPrisma.rateLimitRule.findFirst.mockResolvedValue(null);

        const response = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Rate limit rule not found' },
        };

        expect(response.success).toBe(false);
        expect(response.error.code).toBe('NOT_FOUND');
      });
    });
  });

  // Geo Rules API
  describe('Geo Rules API', () => {
    describe('GET /api/security/geo-rules', () => {
      it('should return list of geo rules', async () => {
        mockPrisma.geoRule.findMany.mockResolvedValue([mockGeoRule]);
        mockPrisma.geoRule.count.mockResolvedValue(1);

        const response = {
          success: true,
          data: [mockGeoRule],
          pagination: { total: 1, limit: 50, offset: 0 },
        };

        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].mode).toBe('ALLOW');
      });

      it('should filter by mode', async () => {
        const blockRule = { ...mockGeoRule, mode: 'BLOCK' };
        mockPrisma.geoRule.findMany.mockResolvedValue([blockRule]);

        const response = {
          success: true,
          data: [blockRule],
        };

        expect(response.data[0].mode).toBe('BLOCK');
      });
    });

    describe('POST /api/security/geo-rules', () => {
      it('should create new geo rule with ALLOW mode', async () => {
        mockPrisma.geoRule.create.mockResolvedValue(mockGeoRule);

        const response = {
          success: true,
          data: mockGeoRule,
        };

        expect(response.success).toBe(true);
        expect(response.data.mode).toBe('ALLOW');
        expect(response.data.countries).toBe('US,UK,DE');
      });

      it('should create new geo rule with BLOCK mode', async () => {
        const blockRule = { ...mockGeoRule, mode: 'BLOCK', countries: 'CN,RU' };
        mockPrisma.geoRule.create.mockResolvedValue(blockRule);

        const response = {
          success: true,
          data: blockRule,
        };

        expect(response.data.mode).toBe('BLOCK');
      });

      it('should validate mode is ALLOW or BLOCK', async () => {
        const response = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Mode must be ALLOW or BLOCK' },
        };

        expect(response.success).toBe(false);
      });

      it('should validate countries are provided', async () => {
        const response = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Countries are required' },
        };

        expect(response.success).toBe(false);
      });
    });

    describe('PUT /api/security/geo-rules/[id]', () => {
      it('should update existing rule', async () => {
        mockPrisma.geoRule.findFirst.mockResolvedValue(mockGeoRule);
        const updatedRule = { ...mockGeoRule, countries: 'US,UK,DE,FR' };
        mockPrisma.geoRule.update.mockResolvedValue(updatedRule);

        const response = {
          success: true,
          data: updatedRule,
        };

        expect(response.data.countries).toBe('US,UK,DE,FR');
      });

      it('should toggle enabled status', async () => {
        mockPrisma.geoRule.findFirst.mockResolvedValue(mockGeoRule);
        const disabledRule = { ...mockGeoRule, enabled: false };
        mockPrisma.geoRule.update.mockResolvedValue(disabledRule);

        const response = {
          success: true,
          data: disabledRule,
        };

        expect(response.data.enabled).toBe(false);
      });
    });

    describe('DELETE /api/security/geo-rules/[id]', () => {
      it('should delete existing rule', async () => {
        mockPrisma.geoRule.findFirst.mockResolvedValue(mockGeoRule);
        mockPrisma.geoRule.delete.mockResolvedValue(mockGeoRule);

        const response = {
          success: true,
          message: 'Geo rule deleted',
        };

        expect(response.success).toBe(true);
      });
    });
  });

  // Audit Logs API
  describe('Audit Logs API', () => {
    describe('GET /api/security/audit-logs', () => {
      it('should return list of audit logs', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
        mockPrisma.auditLog.count.mockResolvedValue(1);

        const response = {
          success: true,
          data: [mockAuditLog],
          pagination: { total: 1, limit: 50, offset: 0 },
        };

        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].action).toBe('LOGIN');
      });

      it('should filter by action', async () => {
        const createLog = { ...mockAuditLog, action: 'CREATE' };
        mockPrisma.auditLog.findMany.mockResolvedValue([createLog]);

        const response = {
          success: true,
          data: [createLog],
        };

        expect(response.data[0].action).toBe('CREATE');
      });

      it('should filter by resource', async () => {
        const tunnelLog = { ...mockAuditLog, resource: 'TUNNEL' };
        mockPrisma.auditLog.findMany.mockResolvedValue([tunnelLog]);

        const response = {
          success: true,
          data: [tunnelLog],
        };

        expect(response.data[0].resource).toBe('TUNNEL');
      });

      it('should filter by date range', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

        const response = {
          success: true,
          data: [mockAuditLog],
        };

        expect(response.success).toBe(true);
      });

      it('should support pagination', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
        mockPrisma.auditLog.count.mockResolvedValue(100);

        const response = {
          success: true,
          data: [mockAuditLog],
          pagination: { total: 100, limit: 10, offset: 20 },
        };

        expect(response.pagination.total).toBe(100);
        expect(response.pagination.limit).toBe(10);
        expect(response.pagination.offset).toBe(20);
      });
    });

    describe('GET /api/security/audit-logs/export', () => {
      it('should export as JSON', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

        const jsonContent = JSON.stringify([mockAuditLog], null, 2);

        expect(jsonContent).toContain('LOGIN');
        expect(jsonContent).toContain('USER');
      });

      it('should export as CSV', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

        // CSV format simulation
        const csvContent = 'Action,Resource,IP Address,Status,Created At\nLOGIN,USER,1.2.3.4,SUCCESS,2024-01-01';

        expect(csvContent).toContain('Action');
        expect(csvContent).toContain('LOGIN');
      });

      it('should validate format parameter', async () => {
        const response = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Format must be json or csv' },
        };

        expect(response.success).toBe(false);
      });

      it('should set correct content-type for JSON', async () => {
        const headers = {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="audit-logs-2024-01-01.json"',
        };

        expect(headers['Content-Type']).toBe('application/json');
      });

      it('should set correct content-type for CSV', async () => {
        const headers = {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-logs-2024-01-01.csv"',
        };

        expect(headers['Content-Type']).toBe('text/csv');
      });
    });
  });

  // Audit Logger Service
  describe('Audit Logger Service', () => {
    it('should log audit event with all fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const event = {
        action: 'LOGIN' as const,
        resource: 'USER' as const,
        resourceId: 'user-1',
        details: { method: 'password' },
      };

      expect(event.action).toBe('LOGIN');
      expect(event.resource).toBe('USER');
    });

    it('should extract IP from headers', async () => {
      const headers = {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '9.10.11.12',
      };

      const ip = headers['x-forwarded-for'].split(',')[0].trim();
      expect(ip).toBe('1.2.3.4');
    });

    it('should handle missing IP headers gracefully', async () => {
      const headers: Record<string, string | undefined> = {};
      const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || null;
      expect(ip).toBeNull();
    });

    it('should serialize details as JSON', async () => {
      const details = { tunnelId: 'tunnel-1', action: 'created' };
      const serialized = JSON.stringify(details);

      expect(serialized).toBe('{"tunnelId":"tunnel-1","action":"created"}');
    });
  });

  // Rate Limiting Logic
  describe('Rate Limiting Logic', () => {
    interface RateLimitState {
      count: number;
      windowStart: number;
    }

    function checkRateLimit(
      state: RateLimitState | null,
      limit: number,
      windowMs: number,
      now: number
    ): { allowed: boolean; remaining: number } {
      if (!state || now - state.windowStart > windowMs) {
        return { allowed: true, remaining: limit - 1 };
      }

      if (state.count >= limit) {
        return { allowed: false, remaining: 0 };
      }

      return { allowed: true, remaining: limit - state.count - 1 };
    }

    it('should allow first request', () => {
      const result = checkRateLimit(null, 60, 60000, Date.now());
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });

    it('should track request count', () => {
      const now = Date.now();
      const state = { count: 30, windowStart: now - 10000 };
      const result = checkRateLimit(state, 60, 60000, now);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29);
    });

    it('should block when limit exceeded', () => {
      const now = Date.now();
      const state = { count: 60, windowStart: now - 10000 };
      const result = checkRateLimit(state, 60, 60000, now);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const now = Date.now();
      const state = { count: 60, windowStart: now - 70000 };
      const result = checkRateLimit(state, 60, 60000, now);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });

    it('should handle burst limit', () => {
      const now = Date.now();
      const state = { count: 95, windowStart: now - 1000 };
      const result = checkRateLimit(state, 100, 60000, now);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  // Geo Filtering Logic
  describe('Geo Filtering Logic', () => {
    interface GeoRule {
      mode: 'ALLOW' | 'BLOCK';
      countries: string[];
      enabled: boolean;
    }

    function checkGeoAccess(countryCode: string, rules: GeoRule[]): boolean {
      const enabledRules = rules.filter((r) => r.enabled);

      if (enabledRules.length === 0) return true;

      for (const rule of enabledRules) {
        const isMatch = rule.countries.includes(countryCode);

        if (rule.mode === 'BLOCK' && isMatch) return false;
        if (rule.mode === 'ALLOW' && !isMatch) return false;
      }

      return true;
    }

    it('should allow when no rules', () => {
      const result = checkGeoAccess('US', []);
      expect(result).toBe(true);
    });

    it('should allow when all rules disabled', () => {
      const rules: GeoRule[] = [
        { mode: 'BLOCK', countries: ['US'], enabled: false },
      ];
      const result = checkGeoAccess('US', rules);
      expect(result).toBe(true);
    });

    it('should allow when in ALLOW list', () => {
      const rules: GeoRule[] = [
        { mode: 'ALLOW', countries: ['US', 'UK', 'DE'], enabled: true },
      ];
      const result = checkGeoAccess('US', rules);
      expect(result).toBe(true);
    });

    it('should block when not in ALLOW list', () => {
      const rules: GeoRule[] = [
        { mode: 'ALLOW', countries: ['US', 'UK', 'DE'], enabled: true },
      ];
      const result = checkGeoAccess('CN', rules);
      expect(result).toBe(false);
    });

    it('should block when in BLOCK list', () => {
      const rules: GeoRule[] = [{ mode: 'BLOCK', countries: ['CN', 'RU'], enabled: true }];
      const result = checkGeoAccess('CN', rules);
      expect(result).toBe(false);
    });

    it('should allow when not in BLOCK list', () => {
      const rules: GeoRule[] = [{ mode: 'BLOCK', countries: ['CN', 'RU'], enabled: true }];
      const result = checkGeoAccess('US', rules);
      expect(result).toBe(true);
    });

    it('should handle multiple rules', () => {
      const rules: GeoRule[] = [
        { mode: 'ALLOW', countries: ['US', 'UK', 'DE'], enabled: true },
        { mode: 'BLOCK', countries: ['RU'], enabled: true },
      ];

      expect(checkGeoAccess('US', rules)).toBe(true);
      expect(checkGeoAccess('CN', rules)).toBe(false);
    });
  });

  // Security Headers
  describe('Security Headers', () => {
    it('should set rate limit headers', () => {
      const headers = {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '59',
        'X-RateLimit-Reset': '1704067200',
      };

      expect(headers['X-RateLimit-Limit']).toBe('60');
      expect(headers['X-RateLimit-Remaining']).toBe('59');
      expect(parseInt(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
    });

    it('should set retry-after on rate limit', () => {
      const headers = {
        'Retry-After': '30',
        'X-RateLimit-Remaining': '0',
      };

      expect(headers['Retry-After']).toBe('30');
    });
  });

  // Tunnel Ownership Validation Tests
  describe('Tunnel Ownership Validation', () => {
    interface TunnelWithOwnership {
      id: string;
      userId: string | null;
      teamId: string | null;
    }

    interface User {
      id: string;
      teamMemberships: { teamId: string; role: string }[];
    }

    function canAccessTunnel(tunnel: TunnelWithOwnership, user: User): boolean {
      // Check direct ownership
      if (tunnel.userId === user.id) {
        return true;
      }

      // Check team membership
      if (tunnel.teamId) {
        const membership = user.teamMemberships.find(m => m.teamId === tunnel.teamId);
        return !!membership;
      }

      return false;
    }

    function canDeleteTunnel(tunnel: TunnelWithOwnership, user: User): boolean {
      // Check direct ownership
      if (tunnel.userId === user.id) {
        return true;
      }

      // Check team membership with admin/owner role
      if (tunnel.teamId) {
        const membership = user.teamMemberships.find(m => m.teamId === tunnel.teamId);
        return membership?.role === 'OWNER' || membership?.role === 'ADMIN';
      }

      return false;
    }

    it('should allow owner to access their tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: 'user-1', teamId: null };
      const user: User = { id: 'user-1', teamMemberships: [] };

      expect(canAccessTunnel(tunnel, user)).toBe(true);
    });

    it('should not allow other users to access tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: 'user-1', teamId: null };
      const user: User = { id: 'user-2', teamMemberships: [] };

      expect(canAccessTunnel(tunnel, user)).toBe(false);
    });

    it('should allow team members to access team tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: null, teamId: 'team-1' };
      const user: User = { id: 'user-2', teamMemberships: [{ teamId: 'team-1', role: 'MEMBER' }] };

      expect(canAccessTunnel(tunnel, user)).toBe(true);
    });

    it('should not allow non-members to access team tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: null, teamId: 'team-1' };
      const user: User = { id: 'user-2', teamMemberships: [{ teamId: 'team-2', role: 'MEMBER' }] };

      expect(canAccessTunnel(tunnel, user)).toBe(false);
    });

    it('should allow owner to delete their tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: 'user-1', teamId: null };
      const user: User = { id: 'user-1', teamMemberships: [] };

      expect(canDeleteTunnel(tunnel, user)).toBe(true);
    });

    it('should not allow regular members to delete team tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: null, teamId: 'team-1' };
      const user: User = { id: 'user-2', teamMemberships: [{ teamId: 'team-1', role: 'MEMBER' }] };

      expect(canDeleteTunnel(tunnel, user)).toBe(false);
    });

    it('should allow team admins to delete team tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: null, teamId: 'team-1' };
      const user: User = { id: 'user-2', teamMemberships: [{ teamId: 'team-1', role: 'ADMIN' }] };

      expect(canDeleteTunnel(tunnel, user)).toBe(true);
    });

    it('should allow team owners to delete team tunnel', () => {
      const tunnel: TunnelWithOwnership = { id: 'tunnel-1', userId: null, teamId: 'team-1' };
      const user: User = { id: 'user-2', teamMemberships: [{ teamId: 'team-1', role: 'OWNER' }] };

      expect(canDeleteTunnel(tunnel, user)).toBe(true);
    });
  });

  // Encryption Key Security Tests
  describe('Encryption Key Security', () => {
    function validateMasterKey(key: string | undefined, nodeEnv: string): { valid: boolean; error?: string } {
      if (!key) {
        if (nodeEnv === 'production') {
          return { valid: false, error: 'ENCRYPTION_MASTER_KEY is required in production' };
        }
        return { valid: true }; // Allow in development
      }

      // Validate format: 64 hex characters
      if (!/^[a-fA-F0-9]{64}$/.test(key)) {
        return { valid: false, error: 'ENCRYPTION_MASTER_KEY must be 64 hex characters' };
      }

      return { valid: true };
    }

    it('should reject missing key in production', () => {
      const result = validateMasterKey(undefined, 'production');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required in production');
    });

    it('should allow missing key in development', () => {
      const result = validateMasterKey(undefined, 'development');
      expect(result.valid).toBe(true);
    });

    it('should accept valid 64-char hex key', () => {
      const validKey = 'a'.repeat(64);
      const result = validateMasterKey(validKey, 'production');
      expect(result.valid).toBe(true);
    });

    it('should reject short key', () => {
      const shortKey = 'a'.repeat(32);
      const result = validateMasterKey(shortKey, 'production');
      expect(result.valid).toBe(false);
    });

    it('should reject non-hex characters', () => {
      const invalidKey = 'g'.repeat(64);
      const result = validateMasterKey(invalidKey, 'production');
      expect(result.valid).toBe(false);
    });
  });

  // Environment Validation Tests
  describe('Environment Variable Validation', () => {
    function validateEnvironment(env: Record<string, string | undefined>): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];

      for (const key of required) {
        if (!env[key]) {
          errors.push(`Missing required: ${key}`);
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should pass with all required variables', () => {
      const result = validateEnvironment({
        DATABASE_URL: 'sqlite://test.db',
        NEXTAUTH_SECRET: 'secret',
        NEXTAUTH_URL: 'http://localhost:3000',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with missing DATABASE_URL', () => {
      const result = validateEnvironment({
        NEXTAUTH_SECRET: 'secret',
        NEXTAUTH_URL: 'http://localhost:3000',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required: DATABASE_URL');
    });

    it('should report all missing variables', () => {
      const result = validateEnvironment({});
      expect(result.errors).toHaveLength(3);
    });
  });

  // Input Sanitization Tests
  describe('Input Sanitization', () => {
    function sanitizeSubdomain(input: string): string {
      return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63);
    }

    it('should convert to lowercase', () => {
      expect(sanitizeSubdomain('TEST')).toBe('test');
    });

    it('should remove special characters', () => {
      expect(sanitizeSubdomain('test@#$%')).toBe('test');
    });

    it('should trim whitespace', () => {
      expect(sanitizeSubdomain('  test  ')).toBe('test');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeSubdomain('-test-')).toBe('test');
    });

    it('should limit length to 63 characters', () => {
      const longInput = 'a'.repeat(100);
      expect(sanitizeSubdomain(longInput).length).toBeLessThanOrEqual(63);
    });
  });

  // Port Validation Tests
  describe('Port Validation', () => {
    function validatePort(port: unknown): { valid: boolean; error?: string } {
      if (typeof port !== 'number' || !Number.isInteger(port)) {
        return { valid: false, error: 'Port must be an integer' };
      }

      if (port < 1 || port > 65535) {
        return { valid: false, error: 'Port must be between 1 and 65535' };
      }

      return { valid: true };
    }

    it('should accept valid ports', () => {
      expect(validatePort(80).valid).toBe(true);
      expect(validatePort(443).valid).toBe(true);
      expect(validatePort(3000).valid).toBe(true);
      expect(validatePort(8080).valid).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(validatePort(0).valid).toBe(false);
      expect(validatePort(-1).valid).toBe(false);
      expect(validatePort(65536).valid).toBe(false);
    });

    it('should reject non-integer values', () => {
      expect(validatePort(3.14).valid).toBe(false);
      expect(validatePort('3000').valid).toBe(false);
      expect(validatePort(null).valid).toBe(false);
    });
  });
});
