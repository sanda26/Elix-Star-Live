import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Smartphone, Coins, Sparkles } from 'lucide-react';
import { STRIPE_CONFIG } from '@/config/stripe';
import { StripePaymentElement } from './StripePaymentElement';
import { platform } from '@/lib/platform';
import {
  loadProducts as loadIAPProducts,
  purchaseProduct,
  initializeIAP,
  IAP_PRODUCTS,
  type IAPProductId,
  type IAPProduct,
} from '@/lib/iap';
import { showToast } from '@/lib/toast';

interface BuyCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (coins: number) => void;
}

export const BuyCoinsModal: React.FC<BuyCoinsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPackage, setSelectedPackage] = useState(STRIPE_CONFIG.coinPackages[0]);
  const [showPaymentElement, setShowPaymentElement] = useState(false);
  const [nativeProducts, setNativeProducts] = useState<IAPProduct[]>([]);
  const [nativeLoading, setNativeLoading] = useState<string | null>(null);
  const isNative = platform.isNative;
  const loading = false;

  useEffect(() => {
    if (isOpen && isNative) {
      loadNative();
    }
  }, [isOpen, isNative]);

  const loadNative = async () => {
    await initializeIAP();
    const products = await loadIAPProducts();
    if (products.length > 0) {
      setNativeProducts(products);
    } else {
      const fallback: IAPProduct[] = Object.entries(IAP_PRODUCTS).map(
        ([id, meta]) => ({
          id,
          title: meta.label,
          description: `Get ${meta.coins} coins`,
          price: '',
          priceAmountMicros: 0,
          coins: meta.coins,
        }),
      );
      setNativeProducts(fallback);
    }
  };

  const handleNativePurchase = async (product: IAPProduct) => {
    setNativeLoading(product.id);
    try {
      const result = await purchaseProduct(product.id as IAPProductId);
      if (result.success) {
        if (onSuccess) onSuccess(product.coins);
        showToast(`+${product.coins.toLocaleString()} coins added!`);
        onClose();
      } else if (result.error !== 'Purchase cancelled') {
        showToast(result.error || 'Purchase failed');
      }
    } catch {
      showToast('Purchase failed');
    } finally {
      setNativeLoading(null);
    }
  };

  const handlePackageSelect = async (coinPackage: typeof STRIPE_CONFIG.coinPackages[0]) => {
    setSelectedPackage(coinPackage);
    setShowPaymentElement(true);
  };

  const handlePaymentSuccess = () => {
    if (onSuccess) onSuccess(selectedPackage.coins);
    onClose();
  };

  const handlePaymentError = (_error: string) => {
    showToast('Payment failed. Please try again.');
  };

  const handleBackToPackages = () => {
    setShowPaymentElement(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[430px] z-[950]" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#13151A] border border-[#C9A96E]/40 flex items-center justify-center">
            <Coins className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Recharge Coins</h2>
            <p className="text-white/60 text-xs">Secure Payment</p>
          </div>
        </div>

        {/* Native IAP (iOS / Android) */}
        {isNative ? (
          <div className="space-y-3">
            {nativeProducts.map((product) => (
              <Button
                key={product.id}
                variant="outline"
                className="w-full justify-between h-auto py-3 border-white/10 hover:border-[#C9A96E]/50 bg-white/5 hover:bg-white/10"
                onClick={() => handleNativePurchase(product)}
                disabled={nativeLoading === product.id}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-[#C9A96E]" />
                  <div className="text-left">
                    <div className="font-semibold text-white">{product.title}</div>
                    {product.price && (
                      <div className="text-sm text-white/60">{product.price}</div>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {nativeLoading === product.id ? 'Processing…' : `${product.coins} coins`}
                </Badge>
              </Button>
            ))}
          </div>
        ) : !showPaymentElement ? (
          /* Web — Stripe package selection */
          <div className="space-y-4">
            <div className="text-center text-sm text-white/60 mb-4">
              Choose a coin package to continue
            </div>
            
            <div className="grid gap-3">
              {STRIPE_CONFIG.coinPackages.map((coinPackage) => (
                <Button
                  key={coinPackage.id}
                  variant={selectedPackage.id === coinPackage.id ? 'default' : 'outline'}
                  className={`w-full justify-between h-auto py-3 relative border-white/10 hover:border-[#C9A96E]/50 transition-colors ${
                    selectedPackage.id === coinPackage.id 
                      ? 'bg-[#C9A96E]/10 border-[#C9A96E] text-white hover:bg-[#C9A96E]/20' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => handlePackageSelect(coinPackage)}
                  disabled={loading}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold text-white">{coinPackage.label}</div>
                      <div className="text-sm opacity-75">${coinPackage.price}</div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`ml-2 ${selectedPackage.id === coinPackage.id ? 'bg-[#C9A96E] text-black' : 'bg-white/10 text-white'}`}
                  >
                    {coinPackage.coins} coins
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-white/60 mt-4">
              <CreditCard className="h-4 w-4" />
              <span>Secure payment powered by Stripe</span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-white/50">
              <Smartphone className="h-3 w-3" />
              <span>Apple Pay & Google Pay supported</span>
            </div>
          </div>
        ) : (
          /* Web — Stripe payment element */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToPackages}
                className="text-white hover:text-white/80 hover:bg-[#C9A96E]/10"
              >
                ← Back to packages
              </Button>
              <div className="text-sm font-medium">
                {selectedPackage.label} - ${selectedPackage.price}
              </div>
            </div>

            <StripePaymentElement
              coinPackage={selectedPackage}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
