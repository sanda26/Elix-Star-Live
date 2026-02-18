# Stripe Setup Guide for ElixStarLive

## Step 1: Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign in to your account (or create one)
3. Click on "Developers" in the left sidebar
4. Click on "API keys"
5. Copy your keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

## Step 2: Create a `.env` File

Create a `.env` file in your project root and add your keys:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_STRIPE_SECRET_KEY=sk_test_your_secret_key_here
VITE_STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Step 3: Configure Stripe Webhook (Optional but Recommended)

1. In your Stripe Dashboard, go to "Developers" > "Webhooks"
2. Click "Add endpoint"
3. Set the endpoint URL to: `https://your-domain.com/api/stripe-webhook`
4. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
5. Copy the webhook signing secret
6. Add it to your `.env` file as `VITE_STRIPE_WEBHOOK_SECRET`

## Step 4: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to your app
3. Try to buy coins - you should see the Stripe payment interface
4. Use test card numbers:
   - **Success**: 4242 4242 4242 4242
   - **Declined**: 4000 0000 0000 0002
   - **Requires authentication**: 4000 0025 0000 3155

## Features Included

✅ **Coin Packages**: 100, 500, 1000, 5000 coins
✅ **Apple Pay**: Automatically enabled on supported devices
✅ **Google Pay**: Automatically enabled on supported devices
✅ **Credit/Debit Cards**: Standard card input
✅ **Secure Processing**: All payments processed through Stripe
✅ **Automatic Coin Updates**: Coins added to user balance after payment
✅ **Transaction History**: All purchases recorded in database

## Troubleshooting

### "Key not configured" Error
- Make sure your `.env` file exists and contains the correct keys
- Restart your development server after adding keys
- Check that keys start with correct prefixes (`pk_test_` or `sk_test_`)

### Payment Fails
- Check Stripe Dashboard for error logs
- Verify your webhook configuration
- Test with Stripe's test card numbers

### Apple Pay/Google Pay Not Showing
- Ensure you're on a supported device/browser
- Check that your domain is verified in Stripe Dashboard
- Make sure HTTPS is enabled (required for wallet payments)

## Need Help?

1. Check Stripe's documentation: https://stripe.com/docs
2. Test with Stripe's test mode first
3. Contact Stripe support if you encounter account issues