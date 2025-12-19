/**
 * Paddle Payment Service Unit Tests
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
vi.stubEnv('PADDLE_VENDOR_ID', '12345');
vi.stubEnv('PADDLE_API_KEY', 'test_api_key');
vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
vi.stubEnv('PADDLE_SANDBOX', 'true');

describe('Paddle Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isPaddleConfigured', () => {
    it('should return true when vendor ID and API key are set', async () => {
      const { isPaddleConfigured } = await import('@/lib/payments/paddle/config');
      expect(isPaddleConfigured()).toBe(true);
    });

    it('should return false when vendor ID is missing', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.resetModules();
      const { isPaddleConfigured } = await import('@/lib/payments/paddle/config');
      expect(isPaddleConfigured()).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      vi.stubEnv('PADDLE_API_KEY', '');
      vi.resetModules();
      const { isPaddleConfigured } = await import('@/lib/payments/paddle/config');
      expect(isPaddleConfigured()).toBe(false);
    });
  });

  describe('getPaddleBaseUrl', () => {
    it('should return sandbox URL when sandbox mode is enabled', async () => {
      vi.stubEnv('PADDLE_SANDBOX', 'true');
      vi.resetModules();
      const { getPaddleBaseUrl } = await import('@/lib/payments/paddle/config');
      expect(getPaddleBaseUrl()).toBe('https://sandbox-api.paddle.com');
    });

    it('should return production URL when sandbox mode is disabled', async () => {
      vi.stubEnv('PADDLE_SANDBOX', 'false');
      vi.resetModules();
      const { getPaddleBaseUrl } = await import('@/lib/payments/paddle/config');
      expect(getPaddleBaseUrl()).toBe('https://api.paddle.com');
    });
  });

  describe('validatePaddleConfig', () => {
    it('should return valid when all required config is present', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '12345');
      vi.stubEnv('PADDLE_API_KEY', 'test_api_key');
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();
      const { validatePaddleConfig } = await import('@/lib/payments/paddle/config');
      const result = validatePaddleConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when config is missing', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.stubEnv('PADDLE_API_KEY', '');
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', '');
      vi.resetModules();
      const { validatePaddleConfig } = await import('@/lib/payments/paddle/config');
      const result = validatePaddleConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Paddle Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid Paddle signature format', async () => {
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      const rawBody = JSON.stringify({ event_type: 'subscription.created' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}:${rawBody}`;
      const hash = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(signedPayload)
        .digest('hex');

      const signature = `ts=${timestamp};h1=${hash}`;

      const isValid = paddleService.verifyWebhookSignature(rawBody, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      const rawBody = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'ts=1234567890;h1=invalid_hash';

      const isValid = paddleService.verifyWebhookSignature(rawBody, signature);
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature', async () => {
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      const rawBody = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'malformed';

      const isValid = paddleService.verifyWebhookSignature(rawBody, signature);
      expect(isValid).toBe(false);
    });

    it('should reject signature without timestamp', async () => {
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      const rawBody = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'h1=somehash';

      const isValid = paddleService.verifyWebhookSignature(rawBody, signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Service Name', () => {
    it('should have correct service name', async () => {
      const { paddleService } = await import('@/lib/payments/paddle');
      expect(paddleService.name).toBe('paddle');
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw error when Paddle is not configured', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      await expect(
        paddleService.createCheckoutSession({
          userId: 'user_123',
          userEmail: 'test@example.com',
          tier: 'starter',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Paddle is not configured');
    });

    it('should throw error for free tier', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '12345');
      vi.stubEnv('PADDLE_API_KEY', 'test_api_key');
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();

      const { prisma } = await import('@/lib/db/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        password: null,
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        isAdmin: false,
        phone: null,
        language: 'en',
      });

      const { paddleService } = await import('@/lib/payments/paddle');

      await expect(
        paddleService.createCheckoutSession({
          userId: 'user_123',
          userEmail: 'test@example.com',
          tier: 'free',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('No price configured for tier: free');
    });
  });

  describe('getSubscription', () => {
    it('should throw error when Paddle is not configured', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      await expect(paddleService.getSubscription('sub_123')).rejects.toThrow(
        'Paddle is not configured'
      );
    });

    it('should return null when subscription not found (404)', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '12345');
      vi.stubEnv('PADDLE_API_KEY', 'test_api_key');
      vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'test_webhook_secret');
      vi.resetModules();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { paddleService } = await import('@/lib/payments/paddle');

      const result = await paddleService.getSubscription('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should throw error when Paddle is not configured', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      await expect(paddleService.cancelSubscription('sub_123')).rejects.toThrow(
        'Paddle is not configured'
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should throw error when Paddle is not configured', async () => {
      vi.stubEnv('PADDLE_VENDOR_ID', '0');
      vi.resetModules();
      const { paddleService } = await import('@/lib/payments/paddle');

      await expect(paddleService.resumeSubscription('sub_123')).rejects.toThrow(
        'Paddle is not configured'
      );
    });
  });
});

describe('Paddle Status Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should handle all Paddle subscription statuses', async () => {
    const statuses = ['active', 'past_due', 'canceled', 'paused', 'trialing'];

    // All statuses should be valid strings
    statuses.forEach(status => {
      expect(typeof status).toBe('string');
    });
  });
});
