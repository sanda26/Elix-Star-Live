export const COIN_RATE_PER_MILLION = 3500; // £3,500 per 1,000,000 coins

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  currency: 'GBP',

  coinPackages: [
    { id: 'coins_10', coins: 10, price: 0.05, label: '10 Coins' },
    { id: 'coins_50', coins: 50, price: 0.18, label: '50 Coins' },
    { id: 'coins_100', coins: 100, price: 0.35, label: '100 Coins' },
    { id: 'coins_500', coins: 500, price: 1.75, label: '500 Coins' },
    { id: 'coins_1000', coins: 1000, price: 3.50, label: '1,000 Coins' },
    { id: 'coins_2000', coins: 2000, price: 7.00, label: '2,000 Coins' },
    { id: 'coins_5000', coins: 5000, price: 17.50, label: '5,000 Coins' },
    { id: 'coins_10000', coins: 10000, price: 35.00, label: '10K Coins' },
    { id: 'coins_20000', coins: 20000, price: 70.00, label: '20K Coins' },
    { id: 'coins_50000', coins: 50000, price: 175.00, label: '50K Coins' },
    { id: 'coins_100000', coins: 100000, price: 350.00, label: '100K Coins' },
    { id: 'coins_500000', coins: 500000, price: 1750.00, label: '500K Coins' },
    { id: 'coins_1000000', coins: 1000000, price: 3500.00, label: '1M Coins' },
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
