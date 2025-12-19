/**
 * Paymob Payment Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
vi.stubEnv('PAYMOB_API_KEY', 'test_api_key');
vi.stubEnv('PAYMOB_INTEGRATION_ID_CARD', '12345');
vi.stubEnv('PAYMOB_HMAC_SECRET', 'test_hmac_secret');

describe('Paymob Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isPaymobConfigured', () => {
    it('should return true when API key and integration ID are set', async () => {
      const { isPaymobConfigured } = await import('@/lib/payments/paymob/config');
      expect(isPaymobConfigured()).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      vi.stubEnv('PAYMOB_API_KEY', '');
      vi.resetModules();
      const { isPaymobConfigured } = await import('@/lib/payments/paymob/config');
      expect(isPaymobConfigured()).toBe(false);
    });

    it('should return false when integration ID is missing', async () => {
      vi.stubEnv('PAYMOB_INTEGRATION_ID_CARD', '0');
      vi.resetModules();
      const { isPaymobConfigured } = await import('@/lib/payments/paymob/config');
      expect(isPaymobConfigured()).toBe(false);
    });
  });

  describe('validatePaymobConfig', () => {
    it('should return valid when all required config is present', async () => {
      vi.stubEnv('PAYMOB_API_KEY', 'test_api_key');
      vi.stubEnv('PAYMOB_INTEGRATION_ID_CARD', '12345');
      vi.stubEnv('PAYMOB_HMAC_SECRET', 'test_hmac_secret');
      vi.resetModules();
      const { validatePaymobConfig } = await import('@/lib/payments/paymob/config');
      const result = validatePaymobConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when config is missing', async () => {
      vi.stubEnv('PAYMOB_API_KEY', '');
      vi.stubEnv('PAYMOB_HMAC_SECRET', '');
      vi.resetModules();
      const { validatePaymobConfig } = await import('@/lib/payments/paymob/config');
      const result = validatePaymobConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Paymob Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid HMAC-SHA512 signature', async () => {
      vi.stubEnv('PAYMOB_HMAC_SECRET', 'test_secret');
      vi.resetModules();
      const { paymobService } = await import('@/lib/payments/paymob');
      const crypto = await import('crypto');

      // The verifyWebhookSignature takes the raw concatenated string
      const payload = 'test_payload_string';
      const expectedHmac = crypto.default
        .createHmac('sha512', 'test_secret')
        .update(payload)
        .digest('hex');

      const isValid = paymobService.verifyWebhookSignature(payload, expectedHmac);
      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      vi.stubEnv('PAYMOB_HMAC_SECRET', 'test_secret');
      vi.resetModules();
      const { paymobService } = await import('@/lib/payments/paymob');

      const payload = 'test_payload_string';
      const isValid = paymobService.verifyWebhookSignature(payload, 'invalid_hmac');
      expect(isValid).toBe(false);
    });
  });

  describe('Service Name', () => {
    it('should have correct service name', async () => {
      const { paymobService } = await import('@/lib/payments/paymob');
      expect(paymobService.name).toBe('paymob');
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw error when Paymob is not configured', async () => {
      vi.stubEnv('PAYMOB_API_KEY', '');
      vi.resetModules();
      const { paymobService } = await import('@/lib/payments/paymob');

      await expect(
        paymobService.createCheckoutSession({
          userId: 'user_123',
          userEmail: 'test@example.com',
          tier: 'starter',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Paymob is not configured');
    });
  });
});
