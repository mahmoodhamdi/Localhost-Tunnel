/**
 * Unified Payment Gateway
 * Central service for managing payments across all providers
 */

import { prisma } from '@/lib/db/prisma';
import { stripeService } from './stripe';
import { isStripeConfigured } from './stripe/config';
import { paymobService } from './paymob';
import { isPaymobConfigured } from './paymob/config';
import { paytabsService } from './paytabs';
import { isPaytabsConfigured } from './paytabs/config';
import { paddleService } from './paddle';
import { isPaddleConfigured } from './paddle/config';
import {
  PaymentProviderName,
  SubscriptionInfo,
  SubscriptionTier,
  CheckoutParams,
  CheckoutResult,
} from './types';
import {
  TIER_LIMITS,
  getProviderForCountry,
  DEFAULT_PROVIDER,
} from './constants';

class PaymentGateway {
  private static instance: PaymentGateway;

  static getInstance(): PaymentGateway {
    if (!PaymentGateway.instance) {
      PaymentGateway.instance = new PaymentGateway();
    }
    return PaymentGateway.instance;
  }

  /**
   * Get payment provider for a specific country
   */
  getProviderForCountry(countryCode: string): PaymentProviderName {
    return getProviderForCountry(countryCode);
  }

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: PaymentProviderName): boolean {
    switch (provider) {
      case 'stripe':
        return isStripeConfigured();
      case 'paymob':
        return isPaymobConfigured();
      case 'paytabs':
        return isPaytabsConfigured();
      case 'paddle':
        return isPaddleConfigured();
      default:
        return false;
    }
  }

  /**
   * Get the best available provider for a country
   * Falls back to other providers if preferred one is not configured
   */
  getBestAvailableProvider(countryCode?: string): PaymentProviderName {
    const preferred = countryCode
      ? this.getProviderForCountry(countryCode)
      : DEFAULT_PROVIDER;

    // If preferred provider is configured, use it
    if (this.isProviderConfigured(preferred)) {
      return preferred;
    }

    // Fall back to first available provider
    const fallbackOrder: PaymentProviderName[] = ['stripe', 'paddle', 'paytabs', 'paymob'];
    for (const provider of fallbackOrder) {
      if (this.isProviderConfigured(provider)) {
        return provider;
      }
    }

    // Default to stripe even if not configured (will fail with clear error)
    return 'stripe';
  }

  /**
   * Create checkout session using appropriate provider
   */
  async createCheckoutSession(
    params: CheckoutParams,
    countryCode?: string
  ): Promise<CheckoutResult> {
    const provider = this.getBestAvailableProvider(countryCode);

    switch (provider) {
      case 'stripe':
        return stripeService.createCheckoutSession(params);
      case 'paymob':
        return paymobService.createCheckoutSession(params);
      case 'paytabs':
        return paytabsService.createCheckoutSession(params);
      case 'paddle':
        return paddleService.createCheckoutSession(params);
      default:
        return stripeService.createCheckoutSession(params);
    }
  }

  /**
   * Cancel subscription using the appropriate provider
   */
  async cancelSubscription(userId: string, immediately: boolean = false): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.externalId) {
      throw new Error('No subscription found');
    }

    switch (subscription.provider) {
      case 'stripe':
        await stripeService.cancelSubscription(subscription.externalId, immediately);
        break;
      case 'paymob':
        await paymobService.cancelSubscription(subscription.externalId, immediately);
        break;
      case 'paytabs':
        await paytabsService.cancelSubscription(subscription.externalId, immediately);
        break;
      case 'paddle':
        await paddleService.cancelSubscription(subscription.externalId, immediately);
        break;
      default:
        throw new Error(`Unknown provider: ${subscription.provider}`);
    }
  }

  /**
   * Get user's subscription info
   */
  async getSubscription(userId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      userId: subscription.userId,
      tier: subscription.tier as SubscriptionTier,
      status: subscription.status as SubscriptionInfo['status'],
      provider: subscription.provider as PaymentProviderName | null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
    };
  }

  /**
   * Get user's subscription tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const subscription = await this.getSubscription(userId);
    return (subscription?.tier as SubscriptionTier) || 'free';
  }

  /**
   * Get tier limits for a user
   */
  async getUserLimits(userId: string) {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier];
  }

  /**
   * Check if user can create more tunnels
   */
  async canCreateTunnel(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
  }> {
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier];

    const tunnelCount = await prisma.tunnel.count({
      where: { userId, isActive: true },
    });

    if (tunnelCount >= limits.tunnels) {
      return {
        allowed: false,
        reason: `Your ${tier} plan allows ${limits.tunnels} active tunnel(s). Upgrade to create more.`,
        currentCount: tunnelCount,
        limit: limits.tunnels,
      };
    }

    return {
      allowed: true,
      currentCount: tunnelCount,
      limit: limits.tunnels,
    };
  }

  /**
   * Check if user can use custom subdomains
   */
  async canUseCustomSubdomain(userId: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].customSubdomain;
  }

  /**
   * Check if user can use custom domains
   */
  async canUseCustomDomain(userId: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].customDomain;
  }

  /**
   * Check if user can use TCP tunnels
   */
  async canUseTcpTunnels(userId: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].tcpTunnels;
  }

  /**
   * Get tunnel timeout for user (null = no timeout)
   */
  async getTunnelTimeout(userId: string): Promise<number | null> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].timeout;
  }

  /**
   * Get user's daily request limit
   */
  async getRequestLimit(userId: string): Promise<number> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].requestsPerDay;
  }

  /**
   * Check if user has priority support
   */
  async hasPrioritySupport(userId: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].prioritySupport;
  }

  /**
   * Get team member limit for user
   */
  async getTeamMemberLimit(userId: string): Promise<number> {
    const tier = await this.getUserTier(userId);
    return TIER_LIMITS[tier].teamMembers;
  }

  /**
   * Check if subscription is active (not canceled or past due)
   */
  async isSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);

    if (!subscription) {
      return true; // Free tier is always "active"
    }

    return ['active', 'trialing'].includes(subscription.status);
  }

  /**
   * Check if user is on trial
   */
  async isOnTrial(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription?.status === 'trialing';
  }

  /**
   * Get days remaining in trial
   */
  async getTrialDaysRemaining(userId: string): Promise<number | null> {
    const subscription = await this.getSubscription(userId);

    if (subscription?.status !== 'trialing' || !subscription.trialEnd) {
      return null;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trialEnd);
    const diffMs = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}

export const paymentGateway = PaymentGateway.getInstance();

// Re-export types
export * from './types';
export * from './constants';
