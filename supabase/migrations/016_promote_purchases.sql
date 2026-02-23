-- Promote purchases — paid boosts (likes, views, followers, profile views)
CREATE TABLE IF NOT EXISTS promote_purchases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type      text NOT NULL,   -- video, profile, live
  content_id        text NOT NULL DEFAULT '',
  goal              text NOT NULL,   -- likes, views, followers, profile
  amount_gbp        numeric(10,2) NOT NULL,
  stripe_session_id text,
  status            text NOT NULL DEFAULT 'completed',  -- completed, pending, failed
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promote_purchases_user ON promote_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_promote_purchases_stripe ON promote_purchases(stripe_session_id);
ALTER TABLE promote_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promote_purchases_select_own" ON promote_purchases FOR SELECT
  USING (auth.uid() = user_id);
