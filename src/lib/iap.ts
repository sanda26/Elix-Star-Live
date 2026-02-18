/**
 * Apple In-App Purchase Service
 * 
 * This module handles iOS In-App Purchases using the Capacitor IAP plugin.
 * 
 * SETUP REQUIRED:
 * 1. Install a Capacitor IAP plugin:
 *    npm install @capawesome-team/capacitor-in-app-purchases
 *    OR use RevenueCat: npm install @revenuecat/purchases-capacitor
 * 
 * 2. Register products in App Store Connect:
 *    - coins_100  (Consumable, $0.99)
 *    - coins_500  (Consumable, $4.99)
 *    - coins_1000 (Consumable, $9.99)
 *    - coins_5000 (Consumable, $49.99)
 * 
 * 3. Add StoreKit capability in Xcode:
 *    Target → Signing & Capabilities → + Capability → In-App Purchase
 * 
 * 4. Set up server-side receipt validation in api/verify-purchase.ts
 */

import { platform } from './platform';

// Product IDs matching App Store Connect
export const IAP_PRODUCT_IDS = [
  'com.elixstar.coins_100',
  'com.elixstar.coins_500',
  'com.elixstar.coins_1000',
  'com.elixstar.coins_5000',
] as const;

export type IAPProductId = typeof IAP_PRODUCT_IDS[number];

export interface IAPProduct {
  id: IAPProductId;
  title: string;
  description: string;
  price: string; // Localized price string from App Store
  priceAmountMicros: number;
  coins: number;
}

export interface IAPPurchaseResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

/**
 * Initialize the IAP service.
 * Call this once on app startup (only on iOS/Android).
 */
export async function initializeIAP(): Promise<void> {
  if (!platform.isNative) {
    console.log('[IAP] Skipping IAP init — not on native platform');
    return;
  }

  // TODO: Initialize IAP plugin when installed
  // Example with @capawesome-team/capacitor-in-app-purchases:
  // await InAppPurchases.initialize();
  // await InAppPurchases.addListener('purchaseCompleted', handlePurchaseCompleted);
  // await InAppPurchases.addListener('purchaseFailed', handlePurchaseFailed);
  
  console.log('[IAP] IAP service initialized for', platform.name);
}

/**
 * Load available products from App Store / Google Play.
 */
export async function loadProducts(): Promise<IAPProduct[]> {
  if (!platform.isNative) {
    console.warn('[IAP] Cannot load IAP products on web');
    return [];
  }

  // TODO: Implement with IAP plugin
  // const { products } = await InAppPurchases.getProducts({ productIds: [...IAP_PRODUCT_IDS] });
  // return products.map(p => ({ ... }));

  console.warn('[IAP] IAP plugin not yet installed — returning empty products');
  return [];
}

/**
 * Purchase a product via Apple IAP / Google Play Billing.
 */
export async function purchaseProduct(_productId: IAPProductId): Promise<IAPPurchaseResult> {
  if (!platform.isNative) {
    return { success: false, error: 'IAP is only available on native platforms' };
  }

  try {
    // TODO: Implement with IAP plugin
    // const result = await InAppPurchases.purchaseProduct({ productId });
    // 
    // // Validate receipt server-side
    // const validation = await fetch('/api/verify-purchase', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    //   body: JSON.stringify({
    //     userId,
    //     packageId: productId,
    //     provider: platform.isIOS ? 'apple' : 'google',
    //     receipt: result.receipt,
    //     transactionId: result.transactionId,
    //   }),
    // });
    // 
    // if (!validation.ok) throw new Error('Receipt validation failed');
    // return { success: true, transactionId: result.transactionId };

    return { success: false, error: 'IAP plugin not yet installed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Purchase failed';
    console.error('[IAP] Purchase error:', message);
    return { success: false, error: message };
  }
}

/**
 * Restore previous purchases (for non-consumable/subscription products).
 */
export async function restorePurchases(): Promise<void> {
  if (!platform.isNative) return;
  
  // TODO: Implement with IAP plugin
  // await InAppPurchases.restorePurchases();
  console.log('[IAP] Restore purchases called');
}
