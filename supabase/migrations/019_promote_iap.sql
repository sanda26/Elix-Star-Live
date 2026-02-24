-- Promote purchases: support Apple/Google IAP (provider + transaction id)
ALTER TABLE promote_purchases ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';
ALTER TABLE promote_purchases ADD COLUMN IF NOT EXISTS provider_transaction_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_promote_purchases_apple_tx ON promote_purchases(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
