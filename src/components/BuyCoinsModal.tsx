import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Smartphone, Coins } from 'lucide-react';
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#C9A96E]/20 flex items-center justify-center">
            <Coins className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Recharge Coins</h2>
            <p className="text-white/60 text-xs">Secure Payment</p>
          </div>
        </div>

        {IS_STORE_BUILD ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-white/60">
              Purchases are handled through the App Store / Play Store in the native app build.
            </div>
            <Button className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : !showPaymentElement ? (
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
                      <div className={`font-semibold ${selectedPackage.id === coinPackage.id ? 'text-white' : 'text-white'}`}>
                        {coinPackage.label}
                      </div>
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
