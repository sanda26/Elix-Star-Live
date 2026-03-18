import type { Request, Response } from "express";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" })
  : null;

export async function createShopCheckoutSession(req: Request, res: Response) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!stripe) return res.status(500).json({ error: "Stripe is not configured" });

  try {
    const { item } = req.body ?? {};
    const title = String(item?.title || "").trim();
    const itemId = String(item?.id || "").trim();
    const sellerId = String(item?.sellerId || item?.user_id || "").trim();
    const currency = String(item?.currency || "gbp").toLowerCase();
    const price = Number(item?.price);

    if (!title || !itemId || !sellerId || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "Invalid item" });
    }

    // Safety clamp — never allow extreme amounts from client.
    const amountCents = Math.max(50, Math.min(500_000, Math.round(price * 100))); // £0.50..£5,000
    const origin = req.headers.origin || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency === "gbp" ? "gbp" : "gbp",
            product_data: {
              name: title,
              description: `Shop item purchase – ${itemId}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/shop?purchase=success`,
      cancel_url: `${origin}/shop?purchase=cancelled`,
      metadata: {
        type: "shop_item",
        itemId,
        sellerId,
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to create checkout session" });
  }
}

