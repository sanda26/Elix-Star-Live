-- =====================================================
-- ELIX STAR LIVE - COMPLETE PRODUCTION DATABASE SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor
-- =====================================================

-- 1) PROFILES TABLE (user profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  website text,
  location text,
  is_creator boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  coins integer DEFAULT 0,
  diamonds integer DEFAULT 0,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  videos_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  caption text,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  is_eligible_for_fyp boolean DEFAULT false
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public videos" ON public.videos FOR SELECT USING (NOT is_private OR auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert videos" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON public.videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON public.videos(created_at DESC);
CREATE INDEX IF NOT EXISTS videos_fyp_idx ON public.videos(is_eligible_for_fyp, engagement_score DESC);

-- 3) LIKES TABLE
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own likes" ON public.likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS likes_video_id_idx ON public.likes(video_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON public.likes(user_id);

-- 4) FOLLOWERS TABLE
CREATE TABLE IF NOT EXISTS public.followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view follows" ON public.followers FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.followers FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS followers_follower_idx ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS followers_following_idx ON public.followers(following_id);

-- 5) COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comments_video_id_idx ON public.comments(video_id);

-- 6) HASHTAGS TABLE
CREATE TABLE IF NOT EXISTS public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text UNIQUE NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view hashtags" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert hashtags" ON public.hashtags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update hashtags" ON public.hashtags FOR UPDATE TO authenticated USING (true);

-- 7) VIDEO_HASHTAGS TABLE (join table)
CREATE TABLE IF NOT EXISTS public.video_hashtags (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, hashtag_id)
);

ALTER TABLE public.video_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view video hashtags" ON public.video_hashtags FOR SELECT USING (true);
CREATE POLICY "Video owners can tag" ON public.video_hashtags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.videos WHERE id = video_id AND user_id = auth.uid())
);

-- 8) LIVE_STREAMS TABLE
CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  stream_key text UNIQUE,
  is_live boolean DEFAULT false,
  viewer_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live streams" ON public.live_streams FOR SELECT USING (true);
CREATE POLICY "Users can create streams" ON public.live_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streams" ON public.live_streams FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS live_streams_user_id_idx ON public.live_streams(user_id);
CREATE INDEX IF NOT EXISTS live_streams_is_live_idx ON public.live_streams(is_live);

-- 9) LIVE_CHAT TABLE
CREATE TABLE IF NOT EXISTS public.live_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.live_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live chat" ON public.live_chat FOR SELECT USING (true);
CREATE POLICY "Authenticated can send messages" ON public.live_chat FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS live_chat_stream_id_idx ON public.live_chat(stream_id);

-- 10) GIFTS_CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.gifts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  price integer NOT NULL,
  animation text DEFAULT 'bounce',
  category text DEFAULT 'basic',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gifts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view gifts" ON public.gifts_catalog FOR SELECT USING (is_active = true);

-- Insert default gifts
INSERT INTO public.gifts_catalog (name, icon, price, animation, category) VALUES
  ('Rose', '🌹', 1, 'bounce', 'basic'),
  ('Heart', '❤️', 5, 'pulse', 'basic'),
  ('Fire', '🔥', 10, 'shake', 'premium'),
  ('Diamond', '💎', 50, 'sparkle', 'premium'),
  ('Dragon', '🐉', 100, 'fly', 'legendary'),
  ('Crown', '👑', 200, 'glow', 'legendary'),
  ('Star', '⭐', 20, 'spin', 'premium'),
  ('Rocket', '🚀', 150, 'fly', 'legendary')
ON CONFLICT DO NOTHING;

-- 11) GIFT_TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_request_id uuid UNIQUE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES public.gifts_catalog(id),
  stream_id uuid REFERENCES public.live_streams(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  diamonds_earned integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.gift_transactions FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Authenticated can send gifts" ON public.gift_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- 12) COIN_PACKAGES TABLE
CREATE TABLE IF NOT EXISTS public.coin_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  coins integer NOT NULL,
  price_usd numeric(10,2) NOT NULL,
  bonus_coins integer DEFAULT 0,
  is_popular boolean DEFAULT false,
  is_active boolean DEFAULT true,
  stripe_price_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view coin packages" ON public.coin_packages FOR SELECT USING (is_active = true);

-- Insert default coin packages
INSERT INTO public.coin_packages (name, coins, price_usd, bonus_coins, is_popular, stripe_price_id) VALUES
  ('Starter', 100, 0.99, 0, false, 'price_starter'),
  ('Basic', 500, 4.99, 50, false, 'price_basic'),
  ('Popular', 1000, 9.99, 150, true, 'price_popular'),
  ('Premium', 5000, 49.99, 1000, false, 'price_premium'),
  ('Ultimate', 10000, 99.99, 2500, false, 'price_ultimate')
ON CONFLICT DO NOTHING;

-- 13) BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own blocks" ON public.blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block" ON public.blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON public.blocks FOR DELETE USING (auth.uid() = blocker_id);

-- 14) REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  reported_comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- 15) DEVICE_TOKENS TABLE (push notifications)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tokens" ON public.device_tokens FOR ALL USING (auth.uid() = user_id);

-- 16) NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

-- =====================================================
-- STORAGE BUCKETS SETUP
-- Run these policies after creating the buckets in Dashboard
-- =====================================================

-- Storage policy for user-content bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to user-content" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to user-content"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-content');

DROP POLICY IF EXISTS "Allow public read user-content" ON storage.objects;
CREATE POLICY "Allow public read user-content"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'user-content');

DROP POLICY IF EXISTS "Allow users to delete own content" ON storage.objects;
CREATE POLICY "Allow users to delete own content"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user-content' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- REALTIME SETUP
-- Enable realtime for specific tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =====================================================
-- DONE! Don't forget to:
-- 1. Create storage bucket 'user-content' (public) in Dashboard
-- 2. Enable Email Auth in Authentication settings
-- 3. Configure OAuth providers (Google, Apple, etc.) if needed
-- 4. Set up Stripe webhooks for payments
-- =====================================================
