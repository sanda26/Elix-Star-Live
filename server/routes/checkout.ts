import { Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "../lib/backend";

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
    retryAfter: Math.ceil((record.timestamp + windowMs - now) / 1000),
  };
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error(
    "[create-checkout-session] STRIPE_SECRET_KEY is not set in server environment",
  );
}
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" })
  : (null as unknown as Stripe);

export async function createCheckoutSession(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { coinPackage, userId } = req.body ?? {};
    const headerUserId = req.headers["x-user-id"] as string | undefined;
    const effectiveUserId =
      (typeof userId === "string" && userId.trim()) || headerUserId;

    if (!coinPackage) {
      return res.status(400).json({ error: "Missing coin package" });
    }
    if (!effectiveUserId) {
      return res.status(400).json({ error: "Missing user id" });
    }

    // Rate limit: prevent checkout spam
    const rateCheck = checkRateLimit(effectiveUserId, "gift:send");
    if (!rateCheck.allowed) {
      return res
        .status(429)
        .json({ error: "Too many requests", retryAfter: rateCheck.retryAfter });
    }

    // Server-side price lookup in GBP — NEVER trust client-supplied prices
    // Rate: £3,500 per 1,000,000 coins (£0.0035/coin)
    const SERVER_COIN_PACKAGES: Record<
      string,
      { coins: number; price: number; label: string }
    > = {
      coins_10: { coins: 10, price: 0.05, label: "10 Coins" },
      coins_50: { coins: 50, price: 0.18, label: "50 Coins" },
      coins_100: { coins: 100, price: 0.35, label: "100 Coins" },
      coins_500: { coins: 500, price: 1.75, label: "500 Coins" },
      coins_1000: { coins: 1000, price: 3.5, label: "1,000 Coins" },
      coins_2000: { coins: 2000, price: 7.0, label: "2,000 Coins" },
      coins_5000: { coins: 5000, price: 17.5, label: "5,000 Coins" },
      coins_10000: { coins: 10000, price: 35.0, label: "10K Coins" },
      coins_20000: { coins: 20000, price: 70.0, label: "20K Coins" },
      coins_50000: { coins: 50000, price: 175.0, label: "50K Coins" },
      coins_100000: { coins: 100000, price: 350.0, label: "100K Coins" },
      coins_500000: { coins: 500000, price: 1750.0, label: "500K Coins" },
      coins_1000000: { coins: 1000000, price: 3500.0, label: "1M Coins" },
    };

    // Support custom amounts: coins_custom_XXXX
    let verifiedPackage = SERVER_COIN_PACKAGES[coinPackage.id];
    if (!verifiedPackage && coinPackage.id?.startsWith("coins_custom_")) {
      const customCoins = parseInt(coinPackage.id.replace("coins_custom_", ""));
      if (customCoins > 0 && customCoins <= 10000000) {
        verifiedPackage = {
          coins: customCoins,
          price: Math.round(customCoins * 0.0035 * 100) / 100,
          label: `${customCoins.toLocaleString()} Coins`,
        };
      }
    }
    if (!verifiedPackage) {
      return res.status(400).json({ error: "Invalid coin package id" });
    }

    // Stripe checkout — WEB ONLY (iOS/Android use Apple IAP / Google Play)
    const origin = req.headers.origin || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: verifiedPackage.label,
              description: `${verifiedPackage.coins} coins for Elix Star Live`,
            },
            unit_amount: Math.round(verifiedPackage.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
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
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}

export async function createSubscriptionSession(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { creatorId, userId } = req.body ?? {};
    const headerUserId = req.headers["x-user-id"] as string | undefined;
    const authHeader = req.headers.authorization;
    const effectiveUserId =
      (typeof userId === "string" && userId.trim()) || headerUserId;

    if (!effectiveUserId) {
      return res.status(400).json({ error: "Missing user id" });
    }

    const rateCheck = checkRateLimit(effectiveUserId, "subscription");
    if (!rateCheck.allowed) {
      return res
        .status(429)
        .json({ error: "Too many requests", retryAfter: rateCheck.retryAfter });
    }

    const MEMBERSHIP_PRICE_GBP = 3.0;
    const amountCents = Math.round(MEMBERSHIP_PRICE_GBP * 100);
    const origin = req.headers.origin || "http://localhost:3000";

    // Resolve creator Stripe Connect account (creatorId may be stream_key or user_id)
    let creatorStripeAccountId: string | null = null;
    if (creatorId) {
      if (!getDb())
        return res
          .status(501)
          .json({ error: "Membership checkout not available." });
      const db = getDb()!;
      let creatorUserId: string | null = creatorId;
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          creatorId,
        );
      if (!isUuid) {
        const { data: stream } = await db
          .from("live_streams")
          .select("user_id")
          .eq("stream_key", creatorId)
          .maybeSingle();
        creatorUserId = stream?.user_id || null;
      }
      if (creatorUserId) {
        const { data: p } = await db
          .from("profiles")
          .select("stripe_connect_account_id")
          .eq("user_id", creatorUserId)
          .maybeSingle();
        creatorStripeAccountId = p?.stripe_connect_account_id || null;
      }
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Super Fan Membership",
              description: "Join the Fan Club – support your favourite creator",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/live/${creatorId || ""}?membership=success`,
      cancel_url: `${origin}/live/${creatorId || ""}?membership=cancelled`,
      client_reference_id: effectiveUserId,
      metadata: {
        type: "membership",
        userId: effectiveUserId,
        creatorId: (creatorId || "").toString(),
      },
    };

    if (creatorStripeAccountId && creatorStripeAccountId.startsWith("acct_")) {
      const platformFeeCents = Math.round(amountCents * 0.3);
      sessionConfig.payment_intent_data = {
        transfer_data: { destination: creatorStripeAccountId },
        application_fee_amount: platformFeeCents,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe subscription checkout error:", error);
    res.status(500).json({ error: "Failed to create subscription session" });
  }
}

// Promote panel — server-side pricing (likes £10, views £5, followers £30, profile £20)
const PROMOTE_PRICES_GBP: Record<string, number> = {
  likes: 10,
  views: 5,
  followers: 30,
  profile: 20,
};

export async function createPromoteCheckoutSession(
  req: Request,
  res: Response,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { userId, contentType, contentId, goal } = req.body ?? {};
    const headerUserId = req.headers["x-user-id"] as string | undefined;
    const effectiveUserId =
      (typeof userId === "string" && userId.trim()) || headerUserId;

    if (!effectiveUserId) {
      return res.status(400).json({ error: "Missing user id" });
    }
    if (!goal || !PROMOTE_PRICES_GBP[goal]) {
      return res.status(400).json({ error: "Invalid or missing goal" });
    }

    const rateCheck = checkRateLimit(effectiveUserId, "promote");
    if (!rateCheck.allowed) {
      return res
        .status(429)
        .json({ error: "Too many requests", retryAfter: rateCheck.retryAfter });
    }

    const priceGbp = PROMOTE_PRICES_GBP[goal];
    const amountCents = Math.round(priceGbp * 100);
    const origin = req.headers.origin || "http://localhost:3000";

    const goalLabels: Record<string, string> = {
      likes: "More likes & comments",
      views: "More video views",
      followers: "More followers",
      profile: "More profile views",
    };
    const label = goalLabels[goal] || goal;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Promote – ${label}`,
              description: `Boost your ${contentType || "content"} on Elix`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/feed?promote=success`,
      cancel_url: `${origin}/feed?promote=cancelled`,
      client_reference_id: effectiveUserId,
      metadata: {
        type: "promote",
        userId: effectiveUserId,
        goal,
        contentType: String(contentType || "video"),
        contentId: String(contentId || ""),
      },
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe promote checkout error:", error);
    res
      .status(500)
      .json({ error: "Failed to create promote checkout session" });
  }
}

export async function createPaymentIntent(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { coinPackage, userId } = req.body ?? {};

    if (!coinPackage?.id || !userId) {
      return res
        .status(400)
        .json({
          error: "Missing required parameters (coinPackage.id, userId)",
        });
    }

    // Rate limit: prevent payment spam
    const rateCheck = checkRateLimit(String(userId), "gift:send");
    if (!rateCheck.allowed) {
      return res
        .status(429)
        .json({ error: "Too many requests", retryAfter: rateCheck.retryAfter });
    }

    // Server-side price lookup in GBP — NEVER trust client-supplied amounts
    // Same packages as checkout session — WEB ONLY (iOS/Android use store billing)
    const SERVER_COIN_PACKAGES: Record<
      string,
      { coins: number; price: number; label: string }
    > = {
      coins_10: { coins: 10, price: 0.05, label: "10 Coins" },
      coins_50: { coins: 50, price: 0.18, label: "50 Coins" },
      coins_100: { coins: 100, price: 0.35, label: "100 Coins" },
      coins_500: { coins: 500, price: 1.75, label: "500 Coins" },
      coins_1000: { coins: 1000, price: 3.5, label: "1,000 Coins" },
      coins_2000: { coins: 2000, price: 7.0, label: "2,000 Coins" },
      coins_5000: { coins: 5000, price: 17.5, label: "5,000 Coins" },
      coins_10000: { coins: 10000, price: 35.0, label: "10K Coins" },
      coins_20000: { coins: 20000, price: 70.0, label: "20K Coins" },
      coins_50000: { coins: 50000, price: 175.0, label: "50K Coins" },
      coins_100000: { coins: 100000, price: 350.0, label: "100K Coins" },
      coins_500000: { coins: 500000, price: 1750.0, label: "500K Coins" },
      coins_1000000: { coins: 1000000, price: 3500.0, label: "1M Coins" },
    };

    let verifiedPackage = SERVER_COIN_PACKAGES[coinPackage.id];
    if (!verifiedPackage && coinPackage.id?.startsWith("coins_custom_")) {
      const customCoins = parseInt(coinPackage.id.replace("coins_custom_", ""));
      if (customCoins > 0 && customCoins <= 10000000) {
        verifiedPackage = {
          coins: customCoins,
          price: Math.round(customCoins * 0.0035 * 100) / 100,
          label: `${customCoins.toLocaleString()} Coins`,
        };
      }
    }
    if (!verifiedPackage) {
      return res.status(400).json({ error: "Invalid coin package id" });
    }

    const verifiedAmountCents = Math.round(verifiedPackage.price * 100);

    // Create Payment Intent — WEB ONLY, GBP
    const paymentIntent = await stripe.paymentIntents.create({
      amount: verifiedAmountCents,
      currency: "gbp",
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
    console.error("Stripe error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/coin-packages — return available coin packages for purchase */
export async function handleGetCoinPackages(_req: Request, res: Response) {
  const packages = [
    {
      id: "coins_10",
      coins: 10,
      price: 0.05,
      label: "10 Coins",
      bonus_coins: 0,
      is_popular: false,
    },
    {
      id: "coins_50",
      coins: 50,
      price: 0.18,
      label: "50 Coins",
      bonus_coins: 0,
      is_popular: false,
    },
    {
      id: "coins_100",
      coins: 100,
      price: 0.35,
      label: "100 Coins",
      bonus_coins: 0,
      is_popular: false,
    },
    {
      id: "coins_500",
      coins: 500,
      price: 1.75,
      label: "500 Coins",
      bonus_coins: 50,
      is_popular: false,
    },
    {
      id: "coins_1000",
      coins: 1000,
      price: 3.5,
      label: "1,000 Coins",
      bonus_coins: 100,
      is_popular: true,
    },
    {
      id: "coins_2000",
      coins: 2000,
      price: 7.0,
      label: "2,000 Coins",
      bonus_coins: 200,
      is_popular: false,
    },
    {
      id: "coins_5000",
      coins: 5000,
      price: 17.5,
      label: "5,000 Coins",
      bonus_coins: 500,
      is_popular: false,
    },
    {
      id: "coins_10000",
      coins: 10000,
      price: 35.0,
      label: "10K Coins",
      bonus_coins: 1000,
      is_popular: false,
    },
    {
      id: "coins_50000",
      coins: 50000,
      price: 175.0,
      label: "50K Coins",
      bonus_coins: 5000,
      is_popular: false,
    },
    {
      id: "coins_100000",
      coins: 100000,
      price: 350.0,
      label: "100K Coins",
      bonus_coins: 10000,
      is_popular: false,
    },
  ];
  return res.status(200).json({ packages });
}
