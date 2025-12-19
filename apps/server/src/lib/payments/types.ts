/**
 * Payment System Types
 * Shared types for all payment providers
 */

// Subscription tiers
export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';

// Subscription status
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';

// Payment provider names
export type PaymentProviderName = 'stripe' | 'paymob' | 'paytabs' | 'paddle';

// Payment status
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';

// Payment method types
export type PaymentMethodType = 'card' | 'wallet' | 'bank_account' | 'kiosk';

// Wallet types (for Paymob)
export type WalletType = 'vodafone_cash' | 'orange' | 'etisalat' | 'we' | 'apple_pay' | 'google_pay';

// Checkout parameters
export interface CheckoutParams {
  userId: string;
  userEmail: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

// Checkout result
export interface CheckoutResult {
  url: string;
  sessionId?: string;
  provider: PaymentProviderName;
}

// Subscription info returned to clients
export interface SubscriptionInfo {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  provider: PaymentProviderName | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

// Payment info returned to clients
export interface PaymentInfo {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProviderName;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: Date;
  receiptUrl: string | null;
}

// Tier limits configuration
export interface TierLimits {
  tunnels: number;
  customSubdomain: boolean;
  customDomain: boolean;
  timeout: number | null; // null = no timeout
  requestsPerDay: number;
  bandwidth: string;
  tcpTunnels: boolean;
  teamMembers: number;
  prioritySupport: boolean;
}

// Tier pricing
export interface TierPricing {
  monthly: number; // in cents
  yearly: number; // in cents (with discount)
  currency: string;
}

// Payment provider interface
export interface PaymentProvider {
  name: PaymentProviderName;

  // Checkout
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;

  // Subscription management
  getSubscription(externalId: string): Promise<SubscriptionInfo | null>;
  cancelSubscription(externalId: string, immediately?: boolean): Promise<void>;
  resumeSubscription?(externalId: string): Promise<void>;

  // Customer portal (if supported)
  createPortalSession?(customerId: string, returnUrl: string): Promise<{ url: string }>;

  // Webhook verification
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}

// Webhook event types
export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.created'
  | 'invoice.paid'
  | 'invoice.payment_failed';

// Normalized webhook event
export interface NormalizedWebhookEvent {
  provider: PaymentProviderName;
  type: WebhookEventType;
  externalId: string;
  customerId?: string;
  subscriptionId?: string;
  paymentId?: string;
  data: Record<string, unknown>;
}

// Price IDs by provider
export interface PriceIds {
  stripe?: {
    starter: string;
    pro: string;
    enterprise: string;
  };
  paddle?: {
    starter: string;
    pro: string;
    enterprise: string;
  };
}

// Region to provider mapping type
export type RegionProviderMap = Record<string, PaymentProviderName>;
