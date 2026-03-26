import { Request, Response } from "express";
import Stripe from "stripe";
import { getTokenFromRequest, verifyAuthToken } from "./auth";
import { getShopItemById } from "../lib/shopStore";

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

function getAuthenticatedUserId(req: Request): string | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  return payload?.sub ?? null;
}

function resolveOrigin(req: Request): string {
  const origin =
    (typeof req.headers.origin === "string" && req.headers.origin.trim()) ||
    process.env.CLIENT_URL;
  if (origin) return origin;
  // Construct from request when behind proxy; require CLIENT_URL in production
  const host = req.headers.host || req.headers["x-forwarded-host"];
  const proto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
}

/** Disabled: coins are only sold via Apple IAP / Google Play Billing (store compliance). */
export async function createCheckoutSession(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(403).json({
    error: "Coin purchases are not available via Stripe. Use in-app purchases in the mobile app.",
  });
}

/** Disabled: membership is only sold via Apple IAP / Google Play Billing. */
export async function createSubscriptionSession(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(403).json({
    error: "Membership is not available via Stripe. Use in-app purchases in the mobile app.",
  });
}

/** Disabled: promote/boost is only sold via Apple IAP / Google Play Billing. */
export async function createPromoteCheckoutSession(
  req: Request,
  res: Response,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(403).json({
    error: "Promote is not available via Stripe. Use in-app purchases in the mobile app.",
  });
}

/** Disabled: coins are only sold via Apple IAP / Google Play Billing. */
export async function createPaymentIntent(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(403).json({
    error: "Coin purchases are not available via Stripe. Use in-app purchases in the mobile app.",
  });
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

/** POST /api/shop/checkout — create Stripe Checkout for a shop item (physical goods) */
export async function createShopItemCheckout(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { itemId } = req.body ?? {};
    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ error: "itemId required" });
    }

    const rateCheck = checkRateLimit(authUserId, "shop_buy");
    if (!rateCheck.allowed) {
      return res
        .status(429)
        .json({ error: "Too many requests", retryAfter: rateCheck.retryAfter });
    }

    const item = getShopItemById(itemId);
    if (!item || !item.is_active) {
      return res.status(404).json({ error: "Item not found or no longer available" });
    }
    if (item.user_id === authUserId) {
      return res.status(400).json({ error: "Cannot buy your own item" });
    }
    if (!item.price || item.price <= 0) {
      return res.status(400).json({ error: "Item has no valid price" });
    }

    const origin = resolveOrigin(req);
    const amountCents = Math.round(item.price * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: item.title,
              description: item.description || "Shop item on Elix Star Live",
              ...(item.image_url ? { images: [item.image_url] } : {}),
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/shop?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop?purchase=cancelled`,
      client_reference_id: authUserId,
      metadata: {
        type: "shop_item",
        userId: authUserId,
        itemId: item.id,
        sellerId: item.user_id,
        itemTitle: item.title.slice(0, 200),
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Shop item checkout error:", error);
    return res.status(500).json({ error: "Failed to create shop checkout" });
  }
}
