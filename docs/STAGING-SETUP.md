# Staging Setup — Safe Coin Testing Without Real Money

This guide shows how to test the full payment flow (Stripe, wallet, gifts) in a staging environment using **Stripe test keys**. No real money is charged.

---

## 1. Why Use Staging?

| Production | Staging |
|------------|---------|
| Real Stripe keys → real charges | Stripe **test** keys → no real money |
| Real user wallets | Isolated test wallets (`server/data/*.json`) |
| `/api/test-coins` removed (correct) | Same codebase, different env |

---

## 2. Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys**
2. Toggle **Test mode** (top-right)
3. Copy:
   - **Publishable key** → `pk_test_...`
   - **Secret key** → `sk_test_...`

---

## 3. Staging Environment Variables

Use the same structure as production, but with **test keys** and a staging URL:

```env
# Staging server URL (e.g. staging.your-app.com or localhost for local staging)
NODE_ENV=development
PORT=8080

# Staging base URL (your staging server)
CLIENT_URL=https://staging.your-app.com
VITE_API_URL=https://staging.your-app.com
VITE_WS_URL=wss://staging.your-app.com

# Stripe TEST keys (not live keys)
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe webhook secret for TEST mode (see Section 4)
STRIPE_WEBHOOK_SECRET=whsec_...

# Same as production (or separate staging instances)
JWT_SECRET=your-staging-jwt-secret
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
# ... Bunny, etc.
```

---

## 4. Stripe Webhook for Staging

Stripe needs to send `checkout.session.completed` and `payment_intent.succeeded` to your backend.

### Option A: Stripe CLI (local or remote)

```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to your staging server
stripe listen --forward-to https://staging.your-app.com/api/stripe-webhook
```

Stripe CLI prints a webhook signing secret (`whsec_...`). Use that as `STRIPE_WEBHOOK_SECRET` for your staging env.

### Option B: Stripe Dashboard (staging URL)

1. [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks) → **Add endpoint**
2. **Endpoint URL:** `https://staging.your-app.com/api/stripe-webhook`
3. **Events to send:** `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## 5. Stripe Test Cards

| Card number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |

- **Expiry:** any future date (e.g. 12/34)
- **CVC:** any 3 digits (e.g. 123)
- **ZIP:** any

[Full list](https://stripe.com/docs/testing#cards)

---

## 6. Step-by-Step Testing

### 6.1 Start Staging Server

```bash
# With staging .env loaded
npm run build
npm run start:prod
# Or: NODE_ENV=development npm run start
```

### 6.2 Coin Purchase (Stripe)

1. Open staging app in browser
2. Log in (or create test account)
3. Go to **Purchase Coins** (or equivalent)
4. Select a package (e.g. 100 coins)
5. Use card `4242 4242 4242 4242`
6. Complete checkout
7. **Verify:** Wallet balance increases; coins persist after refresh

### 6.3 Gift Flow

1. Open a live stream (creator or spectator)
2. Send a gift (uses coins from wallet)
3. **Verify:** Balance decreases; gift appears for recipient

### 6.4 Wallet API Check

```bash
# Get wallet balance (requires auth token)
curl -H "Authorization: Bearer YOUR_JWT" \
  https://staging.your-app.com/api/wallet
```

---

## 7. Wallet Validation Checklist

- [ ] Buy coins with test card → balance increases
- [ ] Refresh app → balance persists (from `server/data/*.json`)
- [ ] Send gift → balance decreases
- [ ] Check `server/data/wallet-*.json` (or equivalent) for correct balance
- [ ] Stripe webhook logs show `checkout.session.completed` / `payment_intent.succeeded`

---

## 8. DO NOT Do This

| Action | Why |
|--------|-----|
| Re-enable `POST /api/test-coins` in production | Users could mint coins |
| Use live Stripe keys in staging | Real charges |
| Use staging keys in production | Payments will fail |
| Enable `IS_STORE_BUILD=false` + test coins in production build | Test coins modal would show to real users (and endpoint is removed anyway) |

---

## 9. Staging Server Options

### A. Separate Coolify/Server

- Deploy same repo to a staging subdomain (e.g. `staging.elixstarlive.com`)
- Set staging env vars (test keys, staging URLs)
- Use separate `server/data/` so production wallets are untouched

### B. Local Staging (same machine)

- Run `npm run start` with a staging `.env`
- Use Stripe CLI to forward webhooks to `http://localhost:8080/api/stripe-webhook`
- Access app at `http://localhost:8080` (or your configured port)

### C. Docker

- Use same Dockerfile, different env file
- Example: `docker run -e STRIPE_SECRET_KEY=sk_test_... ...`

---

## 10. After Staging Passes

1. Keep staging for future regression tests
2. Deploy to production with **live** Stripe keys
3. Configure production webhook in Stripe Dashboard (live mode)
4. Run final smoke test on production with a small real purchase (refund if needed)

---

**Summary:** Staging + Stripe test keys = full end-to-end payment testing with no real money.
