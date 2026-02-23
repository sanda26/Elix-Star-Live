-- Add Stripe Connect account ID for creators (membership/subscription payouts)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
COMMENT ON COLUMN profiles.stripe_connect_account_id IS 'Stripe Connect Express account ID (acct_xxx) for receiving membership payments';
