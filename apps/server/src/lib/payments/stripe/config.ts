/**
 * Stripe Configuration
 */

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  apiVersion: '2023-10-16' as const,

  // Price IDs
  prices: {
    starter: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
    },
  },

  // Trial settings
  trialDays: 14,
};

// Validate configuration
export function validateStripeConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!stripeConfig.secretKey) {
    errors.push('STRIPE_SECRET_KEY is required');
  }

  if (!stripeConfig.webhookSecret) {
    errors.push('STRIPE_WEBHOOK_SECRET is required for webhook verification');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!stripeConfig.secretKey;
}
