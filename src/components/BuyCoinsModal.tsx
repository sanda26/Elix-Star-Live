import React, { useState, useEffect } from 'react';
import { Coins, Sparkles } from 'lucide-react';
import {
  loadProducts as loadIAPProducts,
  purchaseProduct,
  initializeIAP,
  IAP_PRODUCTS,
  type IAPProductId,
  type IAPProduct,
} from '@/lib/iap';
import { showToast } from '@/lib/toast';
import { fetchWalletBalance } from '@/lib/wallet';

interface BuyCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

export const BuyCoinsModal: React.FC<BuyCoinsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [nativeProducts, setNativeProducts] = useState<IAPProduct[]>([]);
  const [nativeLoading, setNativeLoading] = useState<string | null>(null);

  const syncWalletBalance = async (attempts = 5, delayMs = 800): Promise<number | null> => {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const balance = await fetchWalletBalance();
        return balance;
      } catch {
        // Retry briefly because webhooks may lag behind the client payment confirmation.
      }
      if (i < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
    return null;
  };

  useEffect(() => {
    if (isOpen) {
      loadNative();
    }
  }, [isOpen]);

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
        const nextBalance =
          typeof result.newBalance === 'number'
            ? result.newBalance
            : await syncWalletBalance();
        if (onSuccess && typeof nextBalance === 'number') onSuccess(nextBalance);
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

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 pointer-events-auto" style={{ zIndex: 99998 }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[999999] pointer-events-auto max-w-[480px] mx-auto">
        <div className="bg-[#1C1E24]/95 backdrop-blur-md rounded-t-2xl h-[40vh] flex flex-col shadow-2xl border-t border-[#C9A96E]/20 overflow-hidden">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          <div className="flex items-center gap-1.5 px-4 pb-2 flex-shrink-0">
            <Coins className="w-3.5 h-3.5 text-[#C9A96E]" strokeWidth={1.8} />
            <span className="text-white font-bold text-[13px]">Recharge Coins</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {nativeProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleNativePurchase(product)}
                  disabled={nativeLoading !== null}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-[#C9A96E]/10 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#13151A] border border-[#C9A96E]/30 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-[#C9A96E]" strokeWidth={1.8} />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-xs font-semibold">{product.title}</p>
                      {product.price && <p className="text-white/40 text-[10px]">{product.price}</p>}
                    </div>
                  </div>
                  <span className="text-[#C9A96E] text-[10px] font-bold">{nativeLoading === product.id ? 'Processing...' : `${product.coins} coins`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
