export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  
  coinPackages: [
    { id: 'coins_100', coins: 100, price: 0.99, label: '100 Coins' },
    { id: 'coins_500', coins: 500, price: 4.99, label: '500 Coins' },
    { id: 'coins_1000', coins: 1000, price: 9.99, label: '1,000 Coins' },
    { id: 'coins_5000', coins: 5000, price: 49.99, label: '5,000 Coins' },
  ],
  
  subscription: {
    id: 'super_fan_sub',
    price: 3.00,
    currency: 'GBP',
    label: 'Super Fan Subscription',
    interval: 'month'
  }
};

export const getStripeKey = () => {
  return STRIPE_CONFIG.publishableKey;
};

export const hasStripeKey = () => !!STRIPE_CONFIG.publishableKey;
