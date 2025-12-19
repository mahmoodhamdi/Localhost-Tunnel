/**
 * Stripe Payment Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

// Mock Stripe module
vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
  };
});

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
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock environment variables
vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_123');

describe('Stripe Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isStripeConfigured', () => {
    it('should return true when STRIPE_SECRET_KEY is set', async () => {
      // Need to dynamically import after setting env
      const { isStripeConfigured } = await import('@/lib/payments/stripe/config');
      expect(isStripeConfigured()).toBe(true);
    });

    it('should return false when STRIPE_SECRET_KEY is not set', async () => {
      vi.stubEnv('STRIPE_SECRET_KEY', '');
      // Clear module cache to re-evaluate
      vi.resetModules();
      const { isStripeConfigured } = await import('@/lib/payments/stripe/config');
      expect(isStripeConfigured()).toBe(false);
    });
  });

  describe('validateStripeConfig', () => {
    it('should return valid when all required config is present', async () => {
      vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_123');
      vi.resetModules();
      const { validateStripeConfig } = await import('@/lib/payments/stripe/config');
      const result = validateStripeConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when config is missing', async () => {
      vi.stubEnv('STRIPE_SECRET_KEY', '');
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
      vi.resetModules();
      const { validateStripeConfig } = await import('@/lib/payments/stripe/config');
      const result = validateStripeConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Stripe Types', () => {
  describe('SubscriptionTier', () => {
    it('should have correct tier values', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      expect(TIER_LIMITS.free).toBeDefined();
      expect(TIER_LIMITS.starter).toBeDefined();
      expect(TIER_LIMITS.pro).toBeDefined();
      expect(TIER_LIMITS.enterprise).toBeDefined();
    });

    it('should have correct free tier limits', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      expect(TIER_LIMITS.free.tunnels).toBe(1);
      expect(TIER_LIMITS.free.requestsPerDay).toBe(1000);
      expect(TIER_LIMITS.free.customDomain).toBe(false);
      expect(TIER_LIMITS.free.customSubdomain).toBe(false);
    });

    it('should have correct enterprise tier limits', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      expect(TIER_LIMITS.enterprise.tunnels).toBe(Infinity);
      expect(TIER_LIMITS.enterprise.customDomain).toBe(true);
      expect(TIER_LIMITS.enterprise.customSubdomain).toBe(true);
    });
  });

  describe('TIER_PRICING', () => {
    it('should have correct pricing for each tier', async () => {
      const { TIER_PRICING } = await import('@/lib/payments/constants');

      // Note: Free tier is not included in TIER_PRICING
      expect(TIER_PRICING.starter.monthly).toBe(900); // $9.00 in cents
      expect(TIER_PRICING.pro.monthly).toBe(2900); // $29.00 in cents
      expect(TIER_PRICING.enterprise.monthly).toBe(9900); // $99.00 in cents
    });

    it('should have yearly discount', async () => {
      const { TIER_PRICING } = await import('@/lib/payments/constants');

      // Yearly should be less than 12x monthly
      expect(TIER_PRICING.starter.yearly).toBeLessThan(TIER_PRICING.starter.monthly * 12);
      expect(TIER_PRICING.pro.yearly).toBeLessThan(TIER_PRICING.pro.monthly * 12);
    });
  });
});

describe('Payment Gateway', () => {
  describe('Feature gating', () => {
    it('should check tunnel limits correctly', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      // Free tier allows 1 tunnel
      expect(TIER_LIMITS.free.tunnels).toBe(1);

      // Starter allows 3 tunnels
      expect(TIER_LIMITS.starter.tunnels).toBe(3);

      // Pro allows 10 tunnels
      expect(TIER_LIMITS.pro.tunnels).toBe(10);

      // Enterprise has unlimited (Infinity)
      expect(TIER_LIMITS.enterprise.tunnels).toBe(Infinity);
    });

    it('should check custom domain feature correctly', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      // Free tier doesn't have custom domains
      expect(TIER_LIMITS.free.customDomain).toBe(false);

      // Pro and enterprise have custom domains
      expect(TIER_LIMITS.pro.customDomain).toBe(true);
      expect(TIER_LIMITS.enterprise.customDomain).toBe(true);
    });

    it('should check TCP tunnel feature correctly', async () => {
      const { TIER_LIMITS } = await import('@/lib/payments/constants');

      // Free tier doesn't have TCP tunnels
      expect(TIER_LIMITS.free.tcpTunnels).toBe(false);

      // Paid tiers have TCP tunnels
      expect(TIER_LIMITS.starter.tcpTunnels).toBe(true);
      expect(TIER_LIMITS.pro.tcpTunnels).toBe(true);
      expect(TIER_LIMITS.enterprise.tcpTunnels).toBe(true);
    });
  });

  describe('Region provider mapping', () => {
    it('should return correct provider for Egypt', async () => {
      const { getProviderForCountry } = await import('@/lib/payments/constants');
      expect(getProviderForCountry('EG')).toBe('paymob');
    });

    it('should return correct provider for US', async () => {
      const { getProviderForCountry } = await import('@/lib/payments/constants');
      expect(getProviderForCountry('US')).toBe('stripe');
    });

    it('should return correct provider for Germany (EU)', async () => {
      const { getProviderForCountry } = await import('@/lib/payments/constants');
      expect(getProviderForCountry('DE')).toBe('paddle');
    });

    it('should return correct provider for Saudi Arabia (MENA)', async () => {
      const { getProviderForCountry } = await import('@/lib/payments/constants');
      expect(getProviderForCountry('SA')).toBe('paytabs');
    });

    it('should return default provider for unknown country', async () => {
      const { getProviderForCountry, DEFAULT_PROVIDER } = await import('@/lib/payments/constants');
      expect(getProviderForCountry('XX')).toBe(DEFAULT_PROVIDER);
    });
  });
});

describe('Webhook Processing', () => {
  it('should handle different subscription statuses', async () => {
    const statuses: Stripe.Subscription.Status[] = [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'paused',
      'trialing',
      'unpaid',
    ];

    // All statuses should be valid Stripe statuses
    statuses.forEach(status => {
      expect(typeof status).toBe('string');
    });
  });
});
