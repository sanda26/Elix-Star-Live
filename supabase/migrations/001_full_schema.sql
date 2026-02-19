-- ============================================================
-- Elix App — Full Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text UNIQUE,
  display_name  text,
  avatar_url    text,
  bio           text DEFAULT '',
  website       text DEFAULT '',
  instagram     text DEFAULT '',
  youtube       text DEFAULT '',
  tiktok        text DEFAULT '',
  is_creator    boolean DEFAULT false,
  is_admin      boolean DEFAULT false,
  level         int DEFAULT 1,
  coins         int DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://ui-avatars.com/api/?name=' || COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)) || '&background=random')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Videos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url                   text NOT NULL,
  thumbnail_url         text,
  description           text DEFAULT '',
  is_public             boolean DEFAULT true,
  views                 int DEFAULT 0,
  likes                 int DEFAULT 0,
  comments_count        int DEFAULT 0,
  shares_count          int DEFAULT 0,
  engagement_score      float DEFAULT 0,
  is_eligible_for_fyp   boolean DEFAULT true,
  duration_seconds      float DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "videos_select_public" ON videos;
CREATE POLICY "videos_select_public" ON videos FOR SELECT USING (is_public = true OR auth.uid() = user_id);
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "videos_update_own" ON videos;
CREATE POLICY "videos_update_own" ON videos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "videos_delete_own" ON videos;
CREATE POLICY "videos_delete_own" ON videos FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_fyp ON videos(is_eligible_for_fyp, engagement_score DESC) WHERE is_public = true;

-- ── Likes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_select" ON likes;
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own" ON likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

-- ── Comments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  text       text NOT NULL,
  parent_id  uuid REFERENCES comments(id) ON DELETE CASCADE,
  likes      int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);

-- ── Comment Likes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comment_likes_select" ON comment_likes;
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "comment_likes_insert_own" ON comment_likes;
CREATE POLICY "comment_likes_insert_own" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comment_likes_delete_own" ON comment_likes;
CREATE POLICY "comment_likes_delete_own" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- ── Followers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS followers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id <> following_id)
);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "followers_select" ON followers;
CREATE POLICY "followers_select" ON followers FOR SELECT USING (true);
DROP POLICY IF EXISTS "followers_insert_own" ON followers;
CREATE POLICY "followers_insert_own" ON followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "followers_delete_own" ON followers;
CREATE POLICY "followers_delete_own" ON followers FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);

-- ── Shares ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shares (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  platform   text DEFAULT 'copy',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shares_select" ON shares;
CREATE POLICY "shares_select" ON shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "shares_insert_own" ON shares;
CREATE POLICY "shares_insert_own" ON shares FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Video Views ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_views (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  video_id                uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watch_time_seconds      float DEFAULT 0,
  video_duration_seconds  float DEFAULT 0,
  completed               boolean DEFAULT false,
  replayed                boolean DEFAULT false,
  replay_count            int DEFAULT 0,
  ended_at                timestamptz,
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_views_insert_own" ON video_views;
CREATE POLICY "video_views_insert_own" ON video_views FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "video_views_select_own" ON video_views;
CREATE POLICY "video_views_select_own" ON video_views FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);

-- ── Video Interactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_interactions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  video_id         uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE video_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_interactions_insert_own" ON video_interactions;
CREATE POLICY "video_interactions_insert_own" ON video_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "video_interactions_select" ON video_interactions;
CREATE POLICY "video_interactions_select" ON video_interactions FOR SELECT USING (true);

-- ── Hashtags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hashtags (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag        text UNIQUE NOT NULL,
  use_count  int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hashtags_select" ON hashtags;
CREATE POLICY "hashtags_select" ON hashtags FOR SELECT USING (true);
DROP POLICY IF EXISTS "hashtags_insert" ON hashtags;
CREATE POLICY "hashtags_insert" ON hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "hashtags_update" ON hashtags;
CREATE POLICY "hashtags_update" ON hashtags FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ── Video Hashtags (junction) ───────────────────────────────
CREATE TABLE IF NOT EXISTS video_hashtags (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  UNIQUE(video_id, hashtag_id)
);

ALTER TABLE video_hashtags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_hashtags_select" ON video_hashtags;
CREATE POLICY "video_hashtags_select" ON video_hashtags FOR SELECT USING (true);
DROP POLICY IF EXISTS "video_hashtags_insert" ON video_hashtags;
CREATE POLICY "video_hashtags_insert" ON video_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Analytics Events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_insert" ON analytics_events;
CREATE POLICY "analytics_insert" ON analytics_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Coin Transactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_transactions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          int NOT NULL,
  type            text NOT NULL,
  description     text DEFAULT '',
  reference_id    text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coin_transactions_select_own" ON coin_transactions;
CREATE POLICY "coin_transactions_select_own" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "coin_transactions_insert_own" ON coin_transactions;
CREATE POLICY "coin_transactions_insert_own" ON coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text,
  body        text,
  data        jsonb DEFAULT '{}',
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Reports ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  video_id        uuid REFERENCES videos(id) ON DELETE SET NULL,
  reason          text NOT NULL,
  details         text DEFAULT '',
  status          text DEFAULT 'pending',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ── Blocked Users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users_select_own" ON blocked_users;
CREATE POLICY "blocked_users_select_own" ON blocked_users FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocked_users_insert_own" ON blocked_users;
CREATE POLICY "blocked_users_insert_own" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocked_users_delete_own" ON blocked_users;
CREATE POLICY "blocked_users_delete_own" ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- ── Messages / Chat ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_threads (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message text,
  last_at      timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_threads_select_own" ON chat_threads;
CREATE POLICY "chat_threads_select_own" ON chat_threads FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "chat_threads_insert_own" ON chat_threads;
CREATE POLICY "chat_threads_insert_own" ON chat_threads FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "chat_threads_update_own" ON chat_threads;
CREATE POLICY "chat_threads_update_own" ON chat_threads FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id  uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_threads WHERE id = thread_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read" ON messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM chat_threads WHERE id = thread_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at DESC);

-- ── Call Signaling (WebRTC) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS call_signals (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_id     uuid NOT NULL,
  type        text NOT NULL,
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "call_signals_select_own" ON call_signals;
CREATE POLICY "call_signals_select_own" ON call_signals FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);
DROP POLICY IF EXISTS "call_signals_insert_own" ON call_signals;
CREATE POLICY "call_signals_insert_own" ON call_signals FOR INSERT WITH CHECK (auth.uid() = caller_id);
DROP POLICY IF EXISTS "call_signals_delete_own" ON call_signals;
CREATE POLICY "call_signals_delete_own" ON call_signals FOR DELETE USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX IF NOT EXISTS idx_call_signals_call ON call_signals(call_id, created_at);

-- ── Saved Videos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_videos (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE saved_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_videos_select_own" ON saved_videos;
CREATE POLICY "saved_videos_select_own" ON saved_videos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_videos_insert_own" ON saved_videos;
CREATE POLICY "saved_videos_insert_own" ON saved_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_videos_delete_own" ON saved_videos;
CREATE POLICY "saved_videos_delete_own" ON saved_videos FOR DELETE USING (auth.uid() = user_id);

-- ── RPC Functions ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION credit_purchase_coins(p_user_id uuid, p_amount int, p_reference text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET coins = coins + p_amount WHERE user_id = p_user_id;
  INSERT INTO coin_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, p_amount, 'purchase', 'Coin purchase', p_reference);
END;
$$;

CREATE OR REPLACE FUNCTION increment_coin_balance(p_user_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET coins = coins + p_amount WHERE user_id = p_user_id;
END;
$$;

-- Weekly creator ranking based on diamonds (likes/gifts received in last 7 days)
CREATE OR REPLACE FUNCTION get_weekly_creator_ranking(p_limit int DEFAULT 99)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_diamonds bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(d.cnt, 0) DESC) AS rank,
    p.user_id,
    p.username,
    COALESCE(p.display_name, p.username) AS display_name,
    p.avatar_url,
    COALESCE(d.cnt, 0) AS total_diamonds
  FROM profiles p
  LEFT JOIN (
    SELECT v.user_id, COUNT(*) AS cnt
    FROM likes l
    JOIN videos v ON v.id = l.video_id
    WHERE l.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY v.user_id
  ) d ON d.user_id = p.user_id
  WHERE p.is_creator = true OR COALESCE(d.cnt, 0) > 0
  ORDER BY total_diamonds DESC
  LIMIT p_limit;
$$;

-- ── Storage Buckets ─────────────────────────────────────────
-- Run these separately in SQL editor if they fail (buckets may already exist)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-content', 'user-content', true, 524288000, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gift-videos', 'gift-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "user_content_select" ON storage.objects;
CREATE POLICY "user_content_select" ON storage.objects FOR SELECT USING (bucket_id = 'user-content');

DROP POLICY IF EXISTS "user_content_insert" ON storage.objects;
CREATE POLICY "user_content_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-content' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "user_content_update" ON storage.objects;
CREATE POLICY "user_content_update" ON storage.objects FOR UPDATE USING (bucket_id = 'user-content' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "user_content_delete" ON storage.objects;
CREATE POLICY "user_content_delete" ON storage.objects FOR DELETE USING (bucket_id = 'user-content' AND auth.uid() IS NOT NULL);

-- ── Realtime ────────────────────────────────────────────────
-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE videos;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
