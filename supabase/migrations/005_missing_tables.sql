-- ═══════════════════════════════════════════════════════════════
-- Missing tables referenced in application code
-- ═══════════════════════════════════════════════════════════════

-- 1. video_scores — Feed distribution phase algorithm
CREATE TABLE IF NOT EXISTS video_scores (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  phase       text NOT NULL DEFAULT 'test',  -- test, expanding, viral, limited
  score       double precision NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  test_group_size int NOT NULL DEFAULT 100,
  promoted_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_scores_video ON video_scores(video_id);
CREATE INDEX IF NOT EXISTS idx_video_scores_phase ON video_scores(phase);
ALTER TABLE video_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_scores_select" ON video_scores FOR SELECT USING (true);
CREATE POLICY "video_scores_insert" ON video_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "video_scores_update" ON video_scores FOR UPDATE USING (true);

-- 2. user_interests — Feed personalization
CREATE TABLE IF NOT EXISTS user_interests (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text NOT NULL,
  weight      double precision NOT NULL DEFAULT 1.0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, category)
);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_interests_select" ON user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_interests_insert" ON user_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_interests_update" ON user_interests FOR UPDATE USING (auth.uid() = user_id);

-- 3. user_not_interested — "Not interested" feature
CREATE TABLE IF NOT EXISTS user_not_interested (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_user_not_interested_user ON user_not_interested(user_id);
ALTER TABLE user_not_interested ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_not_interested_select" ON user_not_interested FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_not_interested_insert" ON user_not_interested FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_not_interested_delete" ON user_not_interested FOR DELETE USING (auth.uid() = user_id);

-- 4. abuse_log — Rate limit abuse logging
CREATE TABLE IF NOT EXISTS abuse_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address  text,
  action      text NOT NULL,
  details     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abuse_log_user ON abuse_log(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_log_ip ON abuse_log(ip_address);
ALTER TABLE abuse_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abuse_log_insert" ON abuse_log FOR INSERT WITH CHECK (true);
CREATE POLICY "abuse_log_select_admin" ON abuse_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- 5. device_tokens — Push notification tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'web',  -- web, ios, android
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_tokens_own" ON device_tokens FOR ALL USING (auth.uid() = user_id);

-- 6. coin_packages — Purchasable coin bundles
CREATE TABLE IF NOT EXISTS coin_packages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  coins       int NOT NULL,
  price_cents int NOT NULL,
  bonus_coins int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  stripe_price_id text,
  apple_product_id text,
  google_product_id text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_packages_select" ON coin_packages FOR SELECT USING (true);
CREATE POLICY "coin_packages_admin" ON coin_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- Seed default packages
INSERT INTO coin_packages (name, coins, price_cents, bonus_coins, sort_order) VALUES
  ('Starter', 100, 99, 0, 1),
  ('Popular', 500, 499, 50, 2),
  ('Best Value', 1000, 999, 150, 3),
  ('Premium', 5000, 4999, 1000, 4),
  ('VIP', 10000, 9999, 2500, 5)
ON CONFLICT DO NOTHING;

-- 7. purchases — Purchase records for admin dashboard
CREATE TABLE IF NOT EXISTS purchases (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id  uuid REFERENCES coin_packages(id),
  coins       int NOT NULL,
  price_minor int NOT NULL,  -- price in cents
  currency    text NOT NULL DEFAULT 'usd',
  provider    text NOT NULL DEFAULT 'stripe',  -- stripe, apple, google
  provider_id text,
  status      text NOT NULL DEFAULT 'completed',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_own_select" ON purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchases_insert" ON purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "purchases_admin_select" ON purchases FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- 8. gifts_catalog — Admin-managed gift definitions
CREATE TABLE IF NOT EXISTS gifts_catalog (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  coins       int NOT NULL,
  category    text NOT NULL DEFAULT 'standard',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  image_url   text,
  animation_url text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE gifts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts_catalog_select" ON gifts_catalog FOR SELECT USING (true);
CREATE POLICY "gifts_catalog_admin" ON gifts_catalog FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- 9. booster_catalog — Admin-managed booster definitions
CREATE TABLE IF NOT EXISTS booster_catalog (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  coins       int NOT NULL,
  duration_seconds int NOT NULL DEFAULT 60,
  multiplier  double precision NOT NULL DEFAULT 2.0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE booster_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booster_catalog_select" ON booster_catalog FOR SELECT USING (true);
CREATE POLICY "booster_catalog_admin" ON booster_catalog FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- 10. battle_sessions — Battle history persistence
CREATE TABLE IF NOT EXISTS battle_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         text NOT NULL,
  host_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  host_score      int NOT NULL DEFAULT 0,
  opponent_score  int NOT NULL DEFAULT 0,
  winner          text,  -- 'host', 'opponent', 'draw'
  status          text NOT NULL DEFAULT 'waiting',
  duration_seconds int,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_host ON battle_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_opponent ON battle_sessions(opponent_user_id);
ALTER TABLE battle_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battle_sessions_select" ON battle_sessions FOR SELECT USING (true);
CREATE POLICY "battle_sessions_insert" ON battle_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "battle_sessions_update" ON battle_sessions FOR UPDATE USING (true);

-- 11. battle_participants — Battle participant records
CREATE TABLE IF NOT EXISTS battle_participants (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id   uuid NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'opponent',  -- host, opponent
  score       int NOT NULL DEFAULT 0,
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(battle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_battle_participants_battle ON battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_user ON battle_participants(user_id);
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battle_participants_select" ON battle_participants FOR SELECT USING (true);
CREATE POLICY "battle_participants_insert" ON battle_participants FOR INSERT WITH CHECK (true);

-- 12. shop_items — Creator shop items
CREATE TABLE IF NOT EXISTS shop_items (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  price       int NOT NULL DEFAULT 0,  -- in coins
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  stock       int,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_items_user ON shop_items(user_id);
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_items_select" ON shop_items FOR SELECT USING (true);
CREATE POLICY "shop_items_own" ON shop_items FOR ALL USING (auth.uid() = user_id);

-- 13. Add category column to videos table for feed personalization
ALTER TABLE videos ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);

-- Add videos to realtime publication if not already
ALTER PUBLICATION supabase_realtime ADD TABLE video_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_sessions;
