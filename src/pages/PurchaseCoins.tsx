import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';
import { getPaymentMethod, isStripeAllowed } from '../lib/platform';
import { purchaseProduct, type IAPProductId } from '../lib/iap';
import { stripePaymentService, type CoinPackage } from '../lib/stripePaymentService';
import { showToast } from '../lib/toast';

// CoinPackage interface now imported from stripePaymentService

export default function PurchaseCoins() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  };

  const loadPackages = async () => {
    try {
      const packages = await stripePaymentService.getCoinPackages();
      setPackages(packages);
    } catch (error) {

    }
  };

  const handlePurchase = async (pkg: CoinPackage) => {
    if (!currentUserId) {
      showToast('Please log in to purchase coins');
      navigate('/login');
      return;
    }

    setLoading(true);
    setSelectedPackage(pkg);

    try {
      // Track purchase intent
      trackEvent('purchase_intent', {
        package_id: pkg.id,
        coins: pkg.coins,
        price: pkg.price,
      });

      const paymentMethod = getPaymentMethod();

      if (paymentMethod === 'apple-iap' && pkg.stripe_price_id) {
        // iOS — use Apple In-App Purchase
        const result = await purchaseProduct(pkg.stripe_price_id as IAPProductId);
        if (!result.success) {
          throw new Error(result.error || 'IAP purchase failed');
        }
        // Coins are credited server-side via receipt validation
        showToast('Purchase successful! Coins have been added to your account.');
        setLoading(false);
        setSelectedPackage(null);
        return;
      }

      if (paymentMethod === 'google-play' && pkg.stripe_price_id) {
        // Android — use Google Play Billing
        const result = await purchaseProduct(pkg.stripe_price_id as IAPProductId);
        if (!result.success) {
          throw new Error(result.error || 'Play Store purchase failed');
        }
        showToast('Purchase successful! Coins have been added to your account.');
        setLoading(false);
        setSelectedPackage(null);
        return;
      }

      // Web — use Stripe checkout
      if (!isStripeAllowed()) {
        throw new Error('Purchases are not available on this platform. Please use the app.');
      }

      if (!currentUserId) throw new Error('Not authenticated');

      // Use the new Stripe payment service
      const result = await stripePaymentService.processPayment(pkg.id, currentUserId);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      // Payment will redirect to Stripe, so we don't need to continue here
      return;
          } catch (error) {

      showToast(error instanceof Error ? error.message : 'Purchase failed. Please try again.');
      setLoading(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#13151A] text-white flex justify-center px-2">
      <div className="w-full max-w-[480px] h-[100dvh] rounded-3xl overflow-hidden bg-[#13151A] flex flex-col pt-[calc(var(--safe-top)+46px)] pb-[calc(var(--safe-bottom)+110px)]">
      {/* Header */}
      <div className="sticky top-0 bg-[#13151A] z-10 px-4 py-4 border-b border-transparent flex items-center justify-between">
        <button onClick={() => navigate('/feed')} className="p-2 hover:brightness-125 rounded-full transition">
          <img src="/Icons/power-button.png" alt="Back" className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Get Coins</h1>
        <div className="w-10"></div>
      </div>

      <div className="px-4 py-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-[#C9A96E] to-[#B8943F] rounded-full mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-black" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Buy Coins</h2>
          <p className="text-sm text-white/60">Send gifts, unlock features, and support creators</p>
        </div>

        {/* Packages */}
        <div className="space-y-3 mb-8">
          {packages.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg)}
              disabled={loading && selectedPackage?.id === pkg.id}
              className={`w-full p-6 rounded-2xl transition relative overflow-hidden ${
                pkg.is_popular
                  ? 'bg-gradient-to-br from-[#C9A96E]/20 to-[#B8943F]/20 border-2 border-[#C9A96E]'
                  : 'bg-white border-2 border-transparent hover:brightness-125'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pkg.is_popular && (
                <div className="absolute top-3 right-3 px-3 py-1 bg-[#C9A96E] text-black rounded-full text-xs font-bold">
                  POPULAR
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-6 h-6 text-white" />
                    <span className="text-2xl font-bold">{formatNumber(pkg.coins)}</span>
                    {pkg.bonus_coins > 0 && (
                      <span className="px-2 py-1 bg-[#C9A96E] text-black rounded-full text-xs font-bold">
                        +{formatNumber(pkg.bonus_coins)} Bonus
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/60">{pkg.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">${(pkg.price || 0).toFixed(2)}</div>
                  {pkg.bonus_coins > 0 && (
                    <div className="text-xs text-white font-semibold">
                      {Math.round((pkg.bonus_coins / pkg.coins) * 100)}% Bonus
                    </div>
                  )}
                </div>
              </div>

              {loading && selectedPackage?.id === pkg.id && (
                <div className="mt-4 text-center text-sm text-white/60">Processing...</div>
              )}
            </button>
          ))}
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <h3 className="font-bold mb-4">What you can do with coins:</h3>
          <FeatureItem text="Send virtual gifts to your favorite creators" />
          <FeatureItem text="Activate battle boosters during live competitions" />
          <FeatureItem text="Unlock premium features and filters" />
          <FeatureItem text="Support the community and help creators grow" />
        </div>

        {/* Terms */}
        <p className="text-xs text-white/40 text-center mt-6 px-4">
          By purchasing, you agree to our{' '}
          <a href="/terms" className="text-white underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-white underline">
            Privacy Policy
          </a>
          . Purchases are non-refundable except as required by law.
        </p>
      </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 bg-[#C9A96E] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-black" />
      </div>
      <p className="text-sm text-white/80">{text}</p>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}
