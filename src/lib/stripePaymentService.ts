import { loadStripe } from '@stripe/stripe-js';
import { apiUrl } from '../lib/api';
import { platform } from '../lib/platform';
import { useAuthStore } from '../store/useAuthStore';
import { STRIPE_CONFIG } from '../config/stripe';

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  bonus_coins: number;
  is_popular: boolean;
  stripe_price_id: string;
}

export interface PaymentResult {
  success: boolean;
  message: string;
  newBalance?: number;
}

export class StripePaymentService {
  private stripe: any = null;

  private getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  constructor() {
    if (!platform.isNative) {
      this.initializeStripe();
    }
  }

  private async initializeStripe() {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey) {
      this.stripe = await loadStripe(publishableKey);
    }
  }

  /**
   * Get available coin packages from database
   */
  async getCoinPackages(): Promise<CoinPackage[]> {
    try {
      const res = await fetch(apiUrl('/api/coin-packages'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load coin packages');
      }

      const data = await res.json().catch(() => ({})) as {
        packages?: Array<{
          id: string;
          coins: number;
          price: number;
          label: string;
          bonus_coins?: number;
          is_popular?: boolean;
        }>;
      };

      if (Array.isArray(data.packages) && data.packages.length > 0) {
        return data.packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.label,
          coins: pkg.coins,
          price: pkg.price,
          bonus_coins: pkg.bonus_coins ?? 0,
          is_popular: !!pkg.is_popular,
          stripe_price_id: '',
        }));
      }
    } catch {
      // Fall back to the local price table if the backend package list is unavailable.
    }

    return STRIPE_CONFIG.coinPackages.map((pkg) => ({
      id: pkg.id,
      name: pkg.label,
      coins: pkg.coins,
      price: pkg.price,
      bonus_coins: 0,
      is_popular: false,
      stripe_price_id: '',
    }));
  }

  /**
   * Create payment session for coin package
   */
  async createPaymentSession(
    packageId: string,
    userId: string
  ): Promise<{ sessionId?: string; url?: string; error?: string }> {
    try {
      const coinPackage =
        STRIPE_CONFIG.coinPackages.find((pkg) => pkg.id === packageId) ?? {
          id: packageId,
          coins: 0,
          price: 0,
          label: packageId,
        };

      const res = await fetch(apiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          ...this.getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          coinPackage,
        }),
      });

      const data = await res.json().catch(() => ({})) as {
        sessionId?: string;
        url?: string;
        error?: string;
      };

      if (!res.ok) {
        return { error: data.error || 'Failed to create payment session' };
      }

      return { sessionId: data.sessionId, url: data.url };
    } catch {
      return { error: 'Failed to create payment session' };
    }
  }

  /**
   * Create payment session for subscription
   */
  async createSubscriptionSession(
    userId: string
  ): Promise<{ sessionId?: string; url?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl('/api/create-subscription'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          ...this.getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
        }),
      });

      const data = await res.json().catch(() => ({})) as {
        sessionId?: string;
        url?: string;
        error?: string;
      };

      if (!res.ok) {
        return { error: data.error || 'Failed to create subscription session' };
      }

      return { sessionId: data.sessionId, url: data.url };
    } catch {
      return { error: 'Failed to create subscription session' };
    }
  }

  /**
   * Process subscription with Stripe
   */
  async processSubscription(userId: string): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        await this.initializeStripe();
        if (!this.stripe) {
          return { success: false, message: 'Payment service not configured' };
        }
      }

      // Create subscription session
      const { sessionId, error } = await this.createSubscriptionSession(userId);
      
      if (error) {
        return { success: false, message: error };
      }
      
      // Redirect to Stripe Checkout
      if (!sessionId) {
        return { success: false, message: 'Missing checkout session id' };
      }

      const { error: redirectError } = await this.stripe.redirectToCheckout({ sessionId });

      if (redirectError) {
        return { success: false, message: redirectError.message };
      }

      return { success: true, message: 'Redirecting to payment...' };
    } catch (err) {

      return { success: false, message: 'Subscription processing failed' };
    }
  }

  /**
   * Process payment with Stripe
   */
  async processPayment(packageId: string, userId: string): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        await this.initializeStripe();
        if (!this.stripe) {
          return { success: false, message: 'Stripe not initialized' };
        }
      }

      // Create payment session
      const { sessionId, error } = await this.createPaymentSession(packageId, userId);
      
      if (error || !sessionId) {
        return { success: false, message: error || 'Failed to create payment session' };
      }

      // Redirect to Stripe Checkout
      const { error: redirectError } = await this.stripe.redirectToCheckout({
        sessionId,
      });

      if (redirectError) {
        return { success: false, message: redirectError.message };
      }

      return { success: true, message: 'Redirecting to payment...' };
    } catch (err) {

      return { success: false, message: 'Payment processing failed' };
    }
  }

  /**
   * Verify payment and update user coins
   */
  async verifyPayment(sessionId: string): Promise<PaymentResult> {
    void sessionId;
    return { success: false, message: 'Payment verification is handled by the backend webhook' };
  }

  /**
   * Get user's current coin balance
   */
  async getUserBalance(userId: string): Promise<number> {
    void userId;
    return 0;
  }

  /**
   * Check if Stripe is properly configured
   */
  isConfigured(): boolean {
    return !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY && !!this.stripe;
  }
}

// Export singleton instance
export const stripePaymentService = new StripePaymentService();