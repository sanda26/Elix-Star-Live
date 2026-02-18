import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Smartphone } from 'lucide-react';
import { STRIPE_CONFIG } from '@/config/stripe';
import { StripePaymentElement } from './StripePaymentElement';
import { IS_STORE_BUILD } from '@/config/build';

interface BuyCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (coins: number) => void;
}

export const BuyCoinsModal: React.FC<BuyCoinsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPackage, setSelectedPackage] = useState(STRIPE_CONFIG.coinPackages[0]);
  const [showPaymentElement, setShowPaymentElement] = useState(false);
  const loading = false;

  const handlePackageSelect = async (coinPackage: typeof STRIPE_CONFIG.coinPackages[0]) => {
    setSelectedPackage(coinPackage);
    setShowPaymentElement(true);
  };

  const handlePaymentSuccess = () => {
    // Update user's coin balance
    if (onSuccess) {
      onSuccess(selectedPackage.coins);
    }
    onClose();
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    // Show error to user
  };

  const handleBackToPackages = () => {
    setShowPaymentElement(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[430px] z-[950]" onPointerDown={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-center">
            {!showPaymentElement ? 'Buy Coins' : 'Complete Payment'}
          </DialogTitle>
        </DialogHeader>

        {IS_STORE_BUILD ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              Purchases are handled through the App Store / Play Store in the native app build.
            </div>
            <Button className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : !showPaymentElement ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600 mb-4">
              Choose a coin package to continue
            </div>
            
            <div className="grid gap-3">
              {STRIPE_CONFIG.coinPackages.map((coinPackage) => (
                <Button
                  key={coinPackage.id}
                  variant={selectedPackage.id === coinPackage.id ? 'default' : 'outline'}
                  className="w-full justify-between h-auto py-3"
                  onClick={() => handlePackageSelect(coinPackage)}
                  disabled={loading}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">{coinPackage.label}</div>
                      <div className="text-sm opacity-75">${coinPackage.price}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {coinPackage.coins} coins
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mt-4">
              <CreditCard className="h-4 w-4" />
              <span>Secure payment powered by Stripe</span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Smartphone className="h-3 w-3" />
              <span>Apple Pay & Google Pay supported</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToPackages}
                className="text-sm"
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
