/**
 * Unified Payment Gateway
 * Central service for managing payments across all providers
 */

import { prisma } from '@/lib/db/prisma';
import { stripeService } from './stripe';
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
   * Create checkout session using appropriate provider
   */
  async createCheckoutSession(
    params: CheckoutParams,
    countryCode?: string
  ): Promise<CheckoutResult> {
    const provider = countryCode
      ? this.getProviderForCountry(countryCode)
      : DEFAULT_PROVIDER;

    switch (provider) {
      case 'stripe':
        return stripeService.createCheckoutSession(params);
      // TODO: Add other providers when implemented
      // case 'paymob':
      //   return paymobService.createCheckoutSession(params);
      // case 'paytabs':
      //   return paytabsService.createCheckoutSession(params);
      // case 'paddle':
      //   return paddleService.createCheckoutSession(params);
      default:
        return stripeService.createCheckoutSession(params);
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
