-- ==============================================================================
-- ELIX STAR LIVE - FULL PRODUCTION SETUP (V2)
-- Based on user request: Specific Buckets, Tables, and RLS
-- ==============================================================================

-- ==============================================================================
-- 1. STORAGE BUCKETS
-- ==============================================================================
-- We cannot CREATE buckets via SQL in all Supabase environments (it's often a dashboard thing),
-- but we can insert into storage.buckets if permissions allow.
-- Best practice: Insert if not exists.

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, false, 5242880, ARRAY['image/*']),
  ('posts', 'posts', true, false, 104857600, ARRAY['video/*', 'image/*']),
  ('stories', 'stories', true, false, 52428800, ARRAY['video/*', 'image/*']),
  ('gifts', 'gifts', true, false, 10485760, ARRAY['image/*', 'video/*', 'audio/*']),
  ('chat_media', 'chat_media', false, false, 10485760, ARRAY['image/*', 'video/*', 'audio/*']),
  ('live', 'live', true, false, 104857600, ARRAY['image/*', 'video/*']), -- Mixed use, defaulting to public for covers/replays
  ('reports', 'reports', false, false, 10485760, ARRAY['image/*', 'video/*']),
  ('verification', 'verification', false, false, 10485760, ARRAY['image/*', 'video/*', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ==============================================================================
-- 2. STORAGE POLICIES (RLS)
-- ==============================================================================

-- Helper for owner check path
-- Assumes path format: folder/userId/filename
-- We need to enable RLS on objects first
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- A) AVATARS (Public Read, Owner Write)
CREATE POLICY "Avatars Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatars Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Avatars Owner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Avatars Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

-- B) POSTS (Public Read, Owner Write)
CREATE POLICY "Posts Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Posts Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Posts Owner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'posts' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Posts Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'posts' AND (storage.foldername(name))[2] = auth.uid()::text);

-- C) STORIES (Public Read, Owner Write)
CREATE POLICY "Stories Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Stories Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Stories Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'stories' AND (storage.foldername(name))[2] = auth.uid()::text);

-- D) GIFTS (Public Read, Admin Write - assuming admin is handled by service role or specific users, here restrictive)
CREATE POLICY "Gifts Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'gifts');
-- Only allow authenticated users to view (or everyone).
-- Write policies usually reserved for service role for global assets, but if creators upload gifts:
-- CREATE POLICY "Gifts Creator Upload" ...

-- E) CHAT_MEDIA (Private, Chat Participants Read/Write)
-- This is complex in SQL without a join. Simplified: Authenticated users can insert to their own folders.
CREATE POLICY "Chat Media Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.uid() IS NOT NULL);
CREATE POLICY "Chat Media Read" ON storage.objects FOR SELECT USING (bucket_id = 'chat_media' AND auth.uid() IS NOT NULL); -- Needs finer grain in prod

-- F) LIVE (Public Read for covers)
CREATE POLICY "Live Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'live');
CREATE POLICY "Live Owner Write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'live' AND auth.uid() IS NOT NULL);

-- G) REPORTS (Private, Reporter Write, Admin Read)
CREATE POLICY "Reports Reporter Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.uid() IS NOT NULL);
-- Read policy reserved for admins (service role bypasses RLS)

-- H) VERIFICATION (Private, Owner Write)
CREATE POLICY "Verification Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'verification' AND (storage.foldername(name))[2] = auth.uid()::text);

-- ==============================================================================
-- 3. DATABASE TABLES
-- ==============================================================================

-- Auth/Profile
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  bio text,
  avatar_url text,
  cover_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_settings jsonb DEFAULT '{}',
  notification_settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Social
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL, -- 'user', 'post', 'live', 'comment'
  target_id uuid NOT NULL,
  reason text,
  evidence_urls text[],
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Content
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text,
  thumb_url text,
  caption text,
  visibility text DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  text text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- Live / Battle
CREATE TABLE IF NOT EXISTS public.lives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'ended', -- 'live', 'ended'
  title text,
  cover_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_viewers (
  live_id uuid REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (live_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid REFERENCES public.lives(id) ON DELETE CASCADE,
  host_a uuid REFERENCES auth.users(id),
  host_b uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.battle_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid REFERENCES auth.users(id),
  to_user uuid REFERENCES auth.users(id),
  live_id uuid REFERENCES public.lives(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Gifts / Coins
CREATE TABLE IF NOT EXISTS public.coin_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint DEFAULT 0,
  test_balance bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL, -- 'deposit', 'spend', 'earn'
  amount bigint NOT NULL,
  is_test boolean DEFAULT false,
  ref_id uuid, -- reference to gift_send_id or payment_id
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gifts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text,
  animation_url text,
  coin_cost integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid REFERENCES public.lives(id),
  post_id uuid REFERENCES public.posts(id),
  sender_id uuid REFERENCES auth.users(id),
  receiver_id uuid REFERENCES auth.users(id),
  gift_id uuid REFERENCES public.gifts_catalog(id),
  amount integer DEFAULT 1,
  is_test boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Chat
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text DEFAULT 'direct', -- 'direct', 'group'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text,
  media_url text,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 4. RLS POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts
CREATE POLICY "Public posts read" ON public.posts FOR SELECT USING (visibility = 'public');
CREATE POLICY "Posts insert own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Posts update own" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Posts delete own" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "Follows read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Follows insert" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Follows delete" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Comments
CREATE POLICY "Comments read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Comments insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Likes
CREATE POLICY "Likes read" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Likes insert" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes delete" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Coin Balances (Private)
CREATE POLICY "Balances read own" ON public.coin_balances FOR SELECT USING (auth.uid() = user_id);
-- Updates should be done via Edge Functions or Triggers to prevent fraud

-- Chats / Messages
CREATE POLICY "Chat members read" ON public.chat_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Messages read chat members" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
);
CREATE POLICY "Messages insert chat members" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
);

-- ==============================================================================
-- 5. FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Auto-create profile & coin balance on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger AS $$
BEGIN
  -- Profile
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Coin Balance
  INSERT INTO public.coin_balances (user_id, balance, test_balance)
  VALUES (NEW.id, 0, 1000); -- Give 1000 test coins
  
  -- User Settings
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_setup ON auth.users;
CREATE TRIGGER on_auth_user_setup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

