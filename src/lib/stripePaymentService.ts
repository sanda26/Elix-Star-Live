import { loadStripe } from '@stripe/stripe-js';
import { noopClient } from '../lib/noopClient';
import { platform } from '../lib/platform';

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
      const { data, error } = await noopClient
        .from('coin_packages')
        .select('*')
        .eq('is_active', true)
        .order('coins', { ascending: true });

      if (error) {

        return [];
      }

      return data || [];
    } catch (err) {

      return [];
    }
  }

  /**
   * Create payment session for coin package
   */
  async createPaymentSession(
    packageId: string,
    userId: string
  ): Promise<{ sessionId: string; error?: string }> {
    try {
      // Create payment session via backend
      const { data, error } = await noopClient.functions.invoke('create-payment-session', {
        body: {
          packageId,
          userId,
          successUrl: `${window.location.origin}/purchase-success`,
          cancelUrl: `${window.location.origin}/purchase-cancel`,
        }
      });

      if (error) {

        return { sessionId: '', error: error.message };
      }

      return { sessionId: data.sessionId };
    } catch (err) {

      return { sessionId: '', error: 'Failed to create payment session' };
    }
  }

  /**
   * Create payment session for subscription
   */
  async createSubscriptionSession(
    userId: string
  ): Promise<{ sessionId: string; error?: string }> {
    try {
      // Create subscription session via backend
      const { data, error } = await noopClient.functions.invoke('create-subscription-session', {
        body: {
          priceId: 'price_super_fan_gbp', // This would be the real Stripe Price ID
          userId,
          successUrl: `${window.location.origin}/subscription-success`,
          cancelUrl: `${window.location.origin}/subscription-cancel`,
        }
      });

      if (error) {

        return { sessionId: '', error: error.message };
      }

      return { sessionId: data.sessionId };
    } catch (err) {

      return { sessionId: '', error: 'Failed to create subscription session' };
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
      const { error: redirectError } = await this.stripe.redirectToCheckout({
        sessionId,
      });

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
    try {
      // Verify payment via backend
      const { data, error } = await noopClient.functions.invoke('verify-payment', {
        body: { sessionId }
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (data.success) {
        // Update local state if needed
        return { 
          success: true, 
          message: 'Payment successful!',
          newBalance: data.newBalance 
        };
      } else {
        return { success: false, message: data.message || 'Payment verification failed' };
      }
    } catch (err) {

      return { success: false, message: 'Payment verification failed' };
    }
  }

  /**
   * Get user's current coin balance
   */
  async getUserBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await noopClient
        .from('profiles')
        .select('coins')
        .eq('user_id', userId)
        .single();

      if (error) {

        return 0;
      }

      return data?.coins || 0;
    } catch (err) {

      return 0;
    }
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