/**
 * Payment Constants
 * Tier limits, pricing, and region mappings
 */

import { SubscriptionTier, TierLimits, TierPricing, PaymentProviderName, RegionProviderMap } from './types';

// Tier limits configuration
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    tunnels: 1,
    customSubdomain: false,
    customDomain: false,
    timeout: 3600, // 1 hour
    requestsPerDay: 1000,
    bandwidth: '1GB',
    tcpTunnels: false,
    teamMembers: 0,
    prioritySupport: false,
  },
  starter: {
    tunnels: 3,
    customSubdomain: true,
    customDomain: false,
    timeout: null, // No timeout
    requestsPerDay: 10000,
    bandwidth: '10GB',
    tcpTunnels: true,
    teamMembers: 2,
    prioritySupport: false,
  },
  pro: {
    tunnels: 10,
    customSubdomain: true,
    customDomain: true,
    timeout: null,
    requestsPerDay: 100000,
    bandwidth: '100GB',
    tcpTunnels: true,
    teamMembers: 10,
    prioritySupport: true,
  },
  enterprise: {
    tunnels: Infinity,
    customSubdomain: true,
    customDomain: true,
    timeout: null,
    requestsPerDay: Infinity,
    bandwidth: 'Unlimited',
    tcpTunnels: true,
    teamMembers: Infinity,
    prioritySupport: true,
  },
};

// Tier pricing (in cents)
export const TIER_PRICING: Record<Exclude<SubscriptionTier, 'free'>, TierPricing> = {
  starter: {
    monthly: 900, // $9
    yearly: 9000, // $90 (saves $18)
    currency: 'USD',
  },
  pro: {
    monthly: 2900, // $29
    yearly: 29000, // $290 (saves $58)
    currency: 'USD',
  },
  enterprise: {
    monthly: 9900, // $99 (starting price)
    yearly: 99000, // $990
    currency: 'USD',
  },
};

// Region to provider mapping
export const REGION_PROVIDER_MAP: RegionProviderMap = {
  // Egypt - Paymob
  EG: 'paymob',

  // MENA - PayTabs
  SA: 'paytabs', // Saudi Arabia
  AE: 'paytabs', // UAE
  KW: 'paytabs', // Kuwait
  QA: 'paytabs', // Qatar
  BH: 'paytabs', // Bahrain
  OM: 'paytabs', // Oman
  JO: 'paytabs', // Jordan

  // EU - Paddle (for VAT handling via Merchant of Record)
  DE: 'paddle', // Germany
  FR: 'paddle', // France
  GB: 'paddle', // UK
  IT: 'paddle', // Italy
  ES: 'paddle', // Spain
  NL: 'paddle', // Netherlands
  BE: 'paddle', // Belgium
  AT: 'paddle', // Austria
  PT: 'paddle', // Portugal
  IE: 'paddle', // Ireland
  SE: 'paddle', // Sweden
  DK: 'paddle', // Denmark
  FI: 'paddle', // Finland
  NO: 'paddle', // Norway
  PL: 'paddle', // Poland
  CZ: 'paddle', // Czech Republic

  // Americas - Stripe
  US: 'stripe',
  CA: 'stripe',
  MX: 'stripe',
  BR: 'stripe',
  AR: 'stripe',

  // Asia Pacific - Stripe
  JP: 'stripe',
  KR: 'stripe',
  SG: 'stripe',
  AU: 'stripe',
  NZ: 'stripe',
  IN: 'stripe',
};

// Default provider for unknown regions
export const DEFAULT_PROVIDER: PaymentProviderName = 'stripe';

// Get provider for country code
export function getProviderForCountry(countryCode: string): PaymentProviderName {
  return REGION_PROVIDER_MAP[countryCode.toUpperCase()] || DEFAULT_PROVIDER;
}

// Supported currencies by provider
export const PROVIDER_CURRENCIES: Record<PaymentProviderName, string[]> = {
  stripe: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'SGD'],
  paymob: ['EGP', 'USD'],
  paytabs: ['SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'USD'],
  paddle: ['USD', 'EUR', 'GBP'], // Paddle handles currency conversion
};

// Feature flags
export const PAYMENT_FEATURES = {
  // Enable/disable specific providers
  STRIPE_ENABLED: true,
  PAYMOB_ENABLED: true,
  PAYTABS_ENABLED: true,
  PADDLE_ENABLED: true,

  // Enable trial periods
  TRIAL_ENABLED: true,
  TRIAL_DAYS: 14,

  // Enable yearly billing discount
  YEARLY_DISCOUNT_ENABLED: true,
  YEARLY_DISCOUNT_PERCENT: 17, // ~2 months free

  // Enable team features
  TEAMS_ENABLED: true,
};

// Stripe price IDs (from environment)
export const STRIPE_PRICES = {
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
};

// Paddle price IDs (from environment)
export const PADDLE_PRICES = {
  starter: {
    monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY || '',
    yearly: process.env.PADDLE_PRICE_STARTER_YEARLY || '',
  },
  pro: {
    monthly: process.env.PADDLE_PRICE_PRO_MONTHLY || '',
    yearly: process.env.PADDLE_PRICE_PRO_YEARLY || '',
  },
  enterprise: {
    monthly: process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY || '',
    yearly: process.env.PADDLE_PRICE_ENTERPRISE_YEARLY || '',
  },
};

// Paymob integration IDs (from environment)
export const PAYMOB_INTEGRATIONS = {
  card: parseInt(process.env.PAYMOB_INTEGRATION_ID_CARD || '0'),
  wallet: parseInt(process.env.PAYMOB_INTEGRATION_ID_WALLET || '0'),
  kiosk: parseInt(process.env.PAYMOB_INTEGRATION_ID_KIOSK || '0'),
};
