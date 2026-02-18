import { Request, Response } from 'express';
import Stripe from 'stripe';

// Simple rate limiter map
const rateLimits = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(userId: string, action: string) {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const windowMs = 60 * 1000; // 1 minute
  const limit = 5; // 5 requests per minute

  const record = rateLimits.get(key) || { count: 0, timestamp: now };
  
  if (now - record.timestamp > windowMs) {
    record.count = 0;
    record.timestamp = now;
  }

  record.count++;
  rateLimits.set(key, record);

  return {
    allowed: record.count <= limit,
    retryAfter: Math.ceil((record.timestamp + windowMs - now) / 1000)
  };
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('[create-checkout-session] STRIPE_SECRET_KEY is not set in server environment');
}
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' })
  : (null as unknown as Stripe);

export async function createCheckoutSession(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const { coinPackage, userId } = req.body ?? {};
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    const effectiveUserId = (typeof userId === 'string' && userId.trim()) || headerUserId;

    if (!coinPackage) {
      return res.status(400).json({ error: 'Missing coin package' });
    }
    if (!effectiveUserId) {
      return res.status(400).json({ error: 'Missing user id' });
    }

    // Rate limit: prevent checkout spam
    const rateCheck = checkRateLimit(effectiveUserId, 'gift:send');
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: 'Too many requests', retryAfter: rateCheck.retryAfter });
    }

    // Server-side price lookup — NEVER trust client-supplied prices
    const SERVER_COIN_PACKAGES: Record<string, { coins: number; price: number; label: string }> = {
      coins_100:  { coins: 100,  price: 0.99,  label: '100 Coins' },
      coins_500:  { coins: 500,  price: 4.99,  label: '500 Coins' },
      coins_1000: { coins: 1000, price: 9.99,  label: '1,000 Coins' },
      coins_5000: { coins: 5000, price: 49.99, label: '5,000 Coins' },
    };

    const verifiedPackage = SERVER_COIN_PACKAGES[coinPackage.id];
    if (!verifiedPackage) {
      return res.status(400).json({ error: 'Invalid coin package id' });
    }

    // Create Checkout Session with server-verified price
    const origin = req.headers.origin || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: verifiedPackage.label,
              description: `${verifiedPackage.coins} coins for ElixStarLive`,
            },
            unit_amount: Math.round(verifiedPackage.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-cancelled`,
      client_reference_id: effectiveUserId,
      metadata: {
        coinPackageId: coinPackage.id,
        coins: verifiedPackage.coins.toString(),
        userId: effectiveUserId,
      },
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

export async function createPaymentIntent(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const { coinPackage, userId } = req.body ?? {};

    if (!coinPackage?.id || !userId) {
      return res.status(400).json({ error: 'Missing required parameters (coinPackage.id, userId)' });
    }

    // Rate limit: prevent payment spam
    const rateCheck = checkRateLimit(String(userId), 'gift:send');
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: 'Too many requests', retryAfter: rateCheck.retryAfter });
    }

    // Server-side price lookup — NEVER trust client-supplied amounts
    const SERVER_COIN_PACKAGES: Record<string, { coins: number; price: number; label: string }> = {
      coins_100:  { coins: 100,  price: 0.99,  label: '100 Coins' },
      coins_500:  { coins: 500,  price: 4.99,  label: '500 Coins' },
      coins_1000: { coins: 1000, price: 9.99,  label: '1,000 Coins' },
      coins_5000: { coins: 5000, price: 49.99, label: '5,000 Coins' },
    };

    const verifiedPackage = SERVER_COIN_PACKAGES[coinPackage.id];
    if (!verifiedPackage) {
      return res.status(400).json({ error: 'Invalid coin package id' });
    }

    const verifiedAmountCents = Math.round(verifiedPackage.price * 100);

    // Create Payment Intent with server-verified amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: verifiedAmountCents,
      currency: 'usd',
      metadata: {
        coinPackageId: coinPackage.id,
        coins: verifiedPackage.coins.toString(),
        label: verifiedPackage.label,
        userId: userId.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}