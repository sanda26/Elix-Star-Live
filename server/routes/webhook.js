import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
// --- Configuration ---
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY is not set in server environment");
}
const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" })
    : null;
// --- Lazy Supabase Initialization ---
let _supabase = null;
function getSupabase() {
    if (_supabase)
        return _supabase;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRole) {
        console.error("[stripe-webhook] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
        throw new Error("Supabase credentials missing in webhook handler");
    }
    _supabase = createClient(supabaseUrl, supabaseServiceRole);
    return _supabase;
}
// --- Main Webhook Handler ---
export async function handleStripeWebhook(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    const isProd = process.env.NODE_ENV === "production";
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    let event;
    try {
        if (!stripe) {
            return res.status(500).json({ error: "Stripe is not configured on server" });
        }
        // IMPORTANT: req.body MUST be a Buffer here (express.raw on this route)
        const rawBody = req.body;
        if (isProd) {
            if (!sig || !webhookSecret) {
                return res.status(400).json({ error: "Missing signature or webhook secret" });
            }
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        }
        else {
            if (sig && webhookSecret) {
                event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
            }
            else if (webhookSecret) {
                // Secret is set but no signature — reject (possible tampering)
                return res.status(400).json({ error: "Missing Stripe signature" });
            }
            else {
                console.warn("[stripe-webhook] DEV ONLY: No webhook secret configured, skipping signature check");
                event = JSON.parse(rawBody.toString("utf8"));
            }
        }
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).json({ error: "Invalid signature" });
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                await handleSuccessfulPayment(session);
                break;
            }
            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                await handlePaymentIntentSucceeded(paymentIntent);
                break;
            }
            case "charge.refunded": {
                const charge = event.data.object;
                await handleChargeRefunded(charge);
                break;
            }
            case "charge.dispute.created": {
                const dispute = event.data.object;
                await handleChargeDispute(dispute);
                break;
            }
            default:
                console.log("Unhandled event type: " + event.type);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
}
// --- Helper Functions ---
async function creditCoinsFallbackUsers(userId, coins) {
    const { data, error } = await getSupabase().rpc("increment_coin_balance", {
        p_user_id: userId,
        p_amount: coins,
    });
    if (error) {
        console.warn("[Webhook] RPC failed, using fallback update:", error.message);
        const { data: user } = await getSupabase()
            .from("users")
            .select("coin_balance")
            .eq("id", userId)
            .single();
        const currentBalance = Number(user?.coin_balance || 0);
        const newBalance = currentBalance + coins;
        await getSupabase().from("users").update({ coin_balance: newBalance }).eq("id", userId);
        return newBalance;
    }
    return data;
}
async function insertPurchaseTransaction(row) {
    const supabase = getSupabase();
    const { error } = await supabase.from("coin_transactions").insert(row);
    if (error) {
        console.error("Transaction insert failed:", error);
        throw error;
    }
}
async function handleSuccessfulPayment(session) {
    const userId = session.metadata?.userId;
    const coinPackageId = session.metadata?.coinPackageId;
    const coins = parseInt(session.metadata?.coins || "0", 10);
    if (!userId || !coinPackageId || !coins) {
        console.error("Missing metadata in session:", session.metadata);
        return;
    }
    try {
        const amountMoney = session.amount_total ? session.amount_total / 100 : null;
        const currency = session.currency ?? "usd";
        const { error } = await getSupabase().rpc("credit_purchase_coins", {
            p_user_id: userId,
            p_coins: coins,
            p_reason: "purchase",
            p_stripe_session_id: session.id,
            p_amount_money: amountMoney,
            p_currency: currency,
            p_status: "success",
            p_coin_package_id: coinPackageId,
        });
        if (error)
            throw error;
        console.log("Successfully added " + coins + " coins to user " + userId);
    }
    catch (err) {
        console.warn("RPC failed, trying fallback:", err);
        await creditCoinsFallbackUsers(userId, coins);
        await insertPurchaseTransaction({
            user_id: userId,
            delta: coins,
            reason: "purchase",
            coin_package_id: coinPackageId,
            amount_money: session.amount_total ? session.amount_total / 100 : null,
            currency: session.currency ?? "usd",
            status: "success",
            stripe_session_id: session.id,
        });
    }
}
async function handlePaymentIntentSucceeded(paymentIntent) {
    const userId = paymentIntent.metadata?.userId;
    const coins = parseInt(paymentIntent.metadata?.coins || "0", 10);
    const coinPackageId = paymentIntent.metadata?.coinPackageId;
    if (!userId || !coins) {
        console.error("Missing metadata in payment intent:", paymentIntent.metadata);
        return;
    }
    const amountMoney = paymentIntent.amount ? paymentIntent.amount / 100 : null;
    const currency = paymentIntent.currency ?? "usd";
    try {
        const { error } = await getSupabase().rpc("credit_purchase_coins", {
            p_user_id: userId,
            p_coins: coins,
            p_reason: "purchase",
            p_stripe_payment_intent_id: paymentIntent.id,
            p_amount_money: amountMoney,
            p_currency: currency,
            p_status: "success",
            p_coin_package_id: coinPackageId ?? null,
        });
        if (error)
            throw error;
        console.log("Successfully added " + coins + " coins to user " + userId);
    }
    catch (err) {
        console.warn("RPC failed, trying fallback:", err);
        await creditCoinsFallbackUsers(userId, coins);
        await insertPurchaseTransaction({
            user_id: userId,
            delta: coins,
            reason: "purchase",
            coin_package_id: coinPackageId ?? null,
            amount_money: amountMoney,
            currency: currency,
            status: "success",
            stripe_payment_intent_id: paymentIntent.id,
        });
    }
}
// ═══════════════════════════════════════════════════════════════
// CHARGEBACK / REFUND HANDLING
// Coins are non-refundable. We do NOT restore coins to the user.
// We only: (1) log the event, (2) mark purchase as REFUNDED,
// (3) reverse PENDING creator earnings only (never claw back paid).
// ═══════════════════════════════════════════════════════════════
async function handleChargeRefunded(charge) {
    const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    console.warn(`[CHARGEBACK] Charge refunded: ${charge.id}, PI: ${paymentIntentId}`);
    const supabase = getSupabase();
    // Mark the purchase as refunded (do NOT restore coins)
    if (paymentIntentId) {
        await supabase
            .from("coin_transactions")
            .update({ status: "refunded" })
            .eq("stripe_payment_intent_id", paymentIntentId);
        await supabase
            .from("purchases")
            .update({ status: "refunded" })
            .or(`provider_id.eq.${charge.id},provider_id.eq.${paymentIntentId}`);
    }
    // Find gift transactions from this user in the refund window and reverse pending earnings
    const userId = charge.metadata?.userId;
    if (userId) {
        // Record chargeback + auto-freeze if threshold reached
        const { data: abuseResult } = await supabase.rpc("record_chargeback", {
            p_user_id: userId,
            p_reason: "stripe_charge_refunded",
        });
        if (abuseResult?.frozen) {
            console.warn(`[CHARGEBACK] Account ${userId} AUTO-FROZEN after ${abuseResult.chargeback_count} chargebacks`);
        }
        const { data: recentGifts } = await supabase
            .from("gift_transactions")
            .select("id")
            .eq("sender_id", userId)
            .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false });
        if (recentGifts) {
            for (const gift of recentGifts) {
                await supabase.rpc("reverse_pending_earning", { p_gift_tx_id: gift.id });
            }
            console.warn(`[CHARGEBACK] Reversed pending earnings for ${recentGifts.length} gift(s) from user ${userId}`);
        }
    }
}
async function handleChargeDispute(dispute) {
    const chargeId = typeof dispute.charge === "string"
        ? dispute.charge
        : dispute.charge?.id;
    console.warn(`[DISPUTE] Charge disputed: ${chargeId}, reason: ${dispute.reason}`);
    const supabase = getSupabase();
    // Mark purchase as disputed
    if (chargeId) {
        await supabase
            .from("purchases")
            .update({ status: "disputed" })
            .eq("provider_id", chargeId);
    }
    // Same logic: reverse only pending creator earnings
    const paymentIntent = typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : dispute.payment_intent?.id;
    if (paymentIntent) {
        const { data: tx } = await supabase
            .from("coin_transactions")
            .select("user_id")
            .eq("stripe_payment_intent_id", paymentIntent)
            .single();
        if (tx?.user_id) {
            // Record chargeback + auto-freeze if threshold reached
            const { data: abuseResult } = await supabase.rpc("record_chargeback", {
                p_user_id: tx.user_id,
                p_reason: "stripe_dispute",
            });
            if (abuseResult?.frozen) {
                console.warn(`[DISPUTE] Account ${tx.user_id} AUTO-FROZEN after ${abuseResult.chargeback_count} chargebacks`);
            }
            const { data: recentGifts } = await supabase
                .from("gift_transactions")
                .select("id")
                .eq("sender_id", tx.user_id)
                .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
            if (recentGifts) {
                for (const gift of recentGifts) {
                    await supabase.rpc("reverse_pending_earning", { p_gift_tx_id: gift.id });
                }
                console.warn(`[DISPUTE] Reversed pending earnings for ${recentGifts.length} gift(s)`);
            }
        }
    }
}
//# sourceMappingURL=webhook.js.map