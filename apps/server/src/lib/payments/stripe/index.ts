/**
 * Stripe Payment Service
 * Handles all Stripe-related operations
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { stripeConfig, isStripeConfigured } from './config';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  SubscriptionTier,
  SubscriptionStatus,
} from '../types';

class StripeService implements PaymentProvider {
  private static instance: StripeService;
  private stripe: Stripe | null = null;
  public readonly name = 'stripe' as const;

  private constructor() {
    if (isStripeConfigured()) {
      this.stripe = new Stripe(stripeConfig.secretKey, {
        apiVersion: stripeConfig.apiVersion,
        typescript: true,
      });
    }
  }

  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
    }
    return this.stripe;
  }

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string> {
    const stripe = this.ensureStripe();

    // Check if user already has a subscription with customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.externalCustomerId) {
      return subscription.externalCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: { userId },
    });

    return customer.id;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const stripe = this.ensureStripe();

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(
      params.userId,
      params.userEmail,
      user.name || undefined
    );

    // Get price ID for tier
    const priceId = this.getPriceId(params.tier, 'monthly');
    if (!priceId) {
      throw new Error(`No price configured for tier: ${params.tier}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        trial_period_days: stripeConfig.trialDays,
        metadata: {
          userId: params.userId,
          tier: params.tier,
        },
      },
      metadata: {
        userId: params.userId,
        tier: params.tier,
        ...params.metadata,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    return {
      url: session.url!,
      sessionId: session.id,
      provider: 'stripe',
    };
  }

  /**
   * Create a billing portal session
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const stripe = this.ensureStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Get subscription info from Stripe
   */
  async getSubscription(externalId: string): Promise<SubscriptionInfo | null> {
    const stripe = this.ensureStripe();

    try {
      const subscription = await stripe.subscriptions.retrieve(externalId, {
        expand: ['default_payment_method'],
      });

      // Get user ID from metadata
      const userId = subscription.metadata?.userId;
      if (!userId) return null;

      return {
        id: subscription.id,
        userId,
        tier: this.mapPriceToTier(subscription.items.data[0]?.price?.id),
        status: this.mapStripeStatus(subscription.status),
        provider: 'stripe',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      };
    } catch (error) {
      if ((error as Stripe.errors.StripeError).code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(externalId: string, immediately: boolean = false): Promise<void> {
    const stripe = this.ensureStripe();

    if (immediately) {
      await stripe.subscriptions.cancel(externalId);
    } else {
      await stripe.subscriptions.update(externalId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Resume a subscription (undo cancel at period end)
   */
  async resumeSubscription(externalId: string): Promise<void> {
    const stripe = this.ensureStripe();

    await stripe.subscriptions.update(externalId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Update subscription tier (upgrade/downgrade)
   */
  async updateSubscriptionTier(externalId: string, newTier: SubscriptionTier): Promise<void> {
    const stripe = this.ensureStripe();

    const subscription = await stripe.subscriptions.retrieve(externalId);
    const priceId = this.getPriceId(newTier, 'monthly');

    if (!priceId) {
      throw new Error(`No price configured for tier: ${newTier}`);
    }

    await stripe.subscriptions.update(externalId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        tier: newTier,
      },
    });
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    const stripe = this.ensureStripe();

    return stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason: reason as Stripe.RefundCreateParams.Reason | undefined,
    });
  }

  /**
   * Retrieve a checkout session
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const stripe = this.ensureStripe();

    return stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
  }

  /**
   * Construct webhook event from payload and signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const stripe = this.ensureStripe();

    return stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    );
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    try {
      this.constructWebhookEvent(payload, signature);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get price ID for tier and billing period
   */
  private getPriceId(tier: SubscriptionTier, period: 'monthly' | 'yearly'): string | null {
    if (tier === 'free') return null;

    const tierPrices = stripeConfig.prices[tier as keyof typeof stripeConfig.prices];
    if (!tierPrices) return null;

    return tierPrices[period] || null;
  }

  /**
   * Map Stripe price ID to subscription tier
   */
  private mapPriceToTier(priceId?: string): SubscriptionTier {
    if (!priceId) return 'free';

    const { prices } = stripeConfig;

    // Check each tier's prices
    for (const [tier, tierPrices] of Object.entries(prices)) {
      if (tierPrices.monthly === priceId || tierPrices.yearly === priceId) {
        return tier as SubscriptionTier;
      }
    }

    return 'starter'; // Default to starter if unknown
  }

  /**
   * Map Stripe subscription status to our status
   */
  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: 'active',
      canceled: 'canceled',
      incomplete: 'active', // Still allow access during payment setup
      incomplete_expired: 'canceled',
      past_due: 'past_due',
      paused: 'paused',
      trialing: 'trialing',
      unpaid: 'past_due',
    };

    return statusMap[status] || 'active';
  }
}

export const stripeService = StripeService.getInstance();
