import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { config } from "../utils/config";

const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2023-10-16" });

export async function paymentRoutes(fastify: FastifyInstance) {
  // Create checkout session for coins
  fastify.post("/checkout-session", async (request, reply) => {
    const {
      amount,
      currency = "usd",
      successUrl,
      cancelUrl,
    } = request.body as {
      amount: number;
      currency?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!amount || amount <= 0) {
      return reply.code(400).send({ error: "Valid amount is required" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: "Coins Pack" },
              unit_amount: amount * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl || `${config.apiUrl}/success`,
        cancel_url: cancelUrl || `${config.apiUrl}/cancel`,
      });

      return reply.send({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      return reply
        .code(500)
        .send({ error: "Failed to create checkout session" });
    }
  });

  // Stripe webhook
  fastify.post("/webhook", async (request, reply) => {
    const signature = request.headers["stripe-signature"] as string;

    try {
      // In production, verify webhook signature
      // const event = stripe.webhooks.constructEvent(request.body, signature, config.stripeWebhookSecret);
      console.log("[Stripe Webhook] Received");
      return reply.send({ received: true });
    } catch (error) {
      console.error("Invalid webhook:", error);
      return reply.code(400).send({ error: "Invalid webhook" });
    }
  });
}
