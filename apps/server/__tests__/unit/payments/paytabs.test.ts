/**
 * PayTabs Payment Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    webhookEvent: {
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock environment variables
vi.stubEnv('PAYTABS_PROFILE_ID', '12345');
vi.stubEnv('PAYTABS_SERVER_KEY', 'test_server_key');
vi.stubEnv('PAYTABS_REGION', 'SAU');

describe('PayTabs Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isPaytabsConfigured', () => {
    it('should return true when profile ID and server key are set', async () => {
      const { isPaytabsConfigured } = await import('@/lib/payments/paytabs/config');
      expect(isPaytabsConfigured()).toBe(true);
    });

    it('should return false when profile ID is missing', async () => {
      vi.stubEnv('PAYTABS_PROFILE_ID', '');
      vi.resetModules();
      const { isPaytabsConfigured } = await import('@/lib/payments/paytabs/config');
      expect(isPaytabsConfigured()).toBe(false);
    });

    it('should return false when server key is missing', async () => {
      vi.stubEnv('PAYTABS_SERVER_KEY', '');
      vi.resetModules();
      const { isPaytabsConfigured } = await import('@/lib/payments/paytabs/config');
      expect(isPaytabsConfigured()).toBe(false);
    });
  });

  describe('getPaytabsBaseUrl', () => {
    it('should return Saudi Arabia URL for SAU region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'SAU');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure.paytabs.sa');
    });

    it('should return UAE URL for ARE region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'ARE');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure.paytabs.com');
    });

    it('should return Egypt URL for EGY region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'EGY');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure-egypt.paytabs.com');
    });

    it('should return Oman URL for OMN region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'OMN');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure-oman.paytabs.com');
    });

    it('should return Jordan URL for JOR region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'JOR');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure-jordan.paytabs.com');
    });

    it('should return global URL for unknown region', async () => {
      vi.stubEnv('PAYTABS_REGION', 'XXX');
      vi.resetModules();
      const { getPaytabsBaseUrl } = await import('@/lib/payments/paytabs/config');
      expect(getPaytabsBaseUrl()).toBe('https://secure-global.paytabs.com');
    });
  });

  describe('validatePaytabsConfig', () => {
    it('should return valid when all required config is present', async () => {
      vi.stubEnv('PAYTABS_PROFILE_ID', '12345');
      vi.stubEnv('PAYTABS_SERVER_KEY', 'test_server_key');
      vi.resetModules();
      const { validatePaytabsConfig } = await import('@/lib/payments/paytabs/config');
      const result = validatePaytabsConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when config is missing', async () => {
      vi.stubEnv('PAYTABS_PROFILE_ID', '');
      vi.stubEnv('PAYTABS_SERVER_KEY', '');
      vi.resetModules();
      const { validatePaytabsConfig } = await import('@/lib/payments/paytabs/config');
      const result = validatePaytabsConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('PayTabs Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid HMAC-SHA256 signature', async () => {
      vi.stubEnv('PAYTABS_SERVER_KEY', 'test_server_key');
      vi.resetModules();
      const { paytabsService } = await import('@/lib/payments/paytabs');

      const payload = JSON.stringify({ tran_ref: 'TST12345', status: 'A' });
      const expectedSignature = crypto
        .createHmac('sha256', 'test_server_key')
        .update(payload)
        .digest('hex');

      const isValid = paytabsService.verifyWebhookSignature(payload, expectedSignature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      vi.stubEnv('PAYTABS_SERVER_KEY', 'test_server_key');
      vi.resetModules();
      const { paytabsService } = await import('@/lib/payments/paytabs');

      const payload = JSON.stringify({ tran_ref: 'TST12345', status: 'A' });

      const isValid = paytabsService.verifyWebhookSignature(payload, 'invalid_signature');
      expect(isValid).toBe(false);
    });

    it('should handle Buffer payload', async () => {
      vi.stubEnv('PAYTABS_SERVER_KEY', 'test_server_key');
      vi.resetModules();
      const { paytabsService } = await import('@/lib/payments/paytabs');

      const payload = Buffer.from(JSON.stringify({ tran_ref: 'TST12345' }));
      const expectedSignature = crypto
        .createHmac('sha256', 'test_server_key')
        .update(payload.toString())
        .digest('hex');

      const isValid = paytabsService.verifyWebhookSignature(payload, expectedSignature);
      expect(isValid).toBe(true);
    });
  });

  describe('Service Name', () => {
    it('should have correct service name', async () => {
      const { paytabsService } = await import('@/lib/payments/paytabs');
      expect(paytabsService.name).toBe('paytabs');
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw error when PayTabs is not configured', async () => {
      vi.stubEnv('PAYTABS_PROFILE_ID', '');
      vi.resetModules();
      const { paytabsService } = await import('@/lib/payments/paytabs');

      await expect(
        paytabsService.createCheckoutSession({
          userId: 'user_123',
          userEmail: 'test@example.com',
          tier: 'starter',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('PayTabs is not configured');
    });
  });

  describe('cancelSubscription', () => {
    it('should throw error when subscription not found', async () => {
      const { prisma } = await import('@/lib/db/prisma');
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const { paytabsService } = await import('@/lib/payments/paytabs');

      await expect(paytabsService.cancelSubscription('non_existent_id')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });
});
