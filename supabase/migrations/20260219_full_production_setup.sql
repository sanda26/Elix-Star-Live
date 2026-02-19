-- =====================================================
-- ELIX APP NEW3 - FULL PRODUCTION SETUP
-- Run this in Supabase Dashboard -> SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. STORAGE BUCKETS
-- =====================================================
-- We insert into storage.buckets. 
-- Note: 'public' column determines if objects are publicly serving.
INSERT INTO storage.buckets (id, name, public) VALUES
('avatars', 'avatars', true),
('posts', 'posts', true),
('stories', 'stories', true),
('gifts', 'gifts', true),
('chat_media', 'chat_media', false),
('live', 'live', true),
('reports', 'reports', false),
('verification', 'verification', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- =====================================================
-- 2. DATABASE TABLES
-- =====================================================

-- 2.1 PROFILES (Auth/Profile)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    display_name text,
    bio text,
    avatar_url text,
    cover_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.2 USER SETTINGS
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    privacy_level text DEFAULT 'public', -- public, friends, private
    notification_prefs jsonb DEFAULT '{"push": true, "email": true}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2.3 SOCIAL (Follows, Blocks, Reports)
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type text NOT NULL, -- 'user', 'post', 'comment', 'live'
    target_id uuid NOT NULL,
    reason text NOT NULL,
    evidence_urls text[],
    status text DEFAULT 'pending', -- pending, resolved, dismissed
    created_at timestamptz DEFAULT now()
);

-- 2.4 CONTENT (Posts, Likes, Comments)
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_url text NOT NULL,
    thumb_url text,
    caption text,
    visibility text DEFAULT 'public', -- public, friends, private
    views integer DEFAULT 0,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    shares_count integer DEFAULT 0,
    engagement_score integer DEFAULT 0,
    is_eligible_for_fyp boolean DEFAULT false,
    category text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Analytics & Scoring Tables (Required for Feed Algorithm)
CREATE TABLE IF NOT EXISTS public.video_views (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    watch_time_seconds integer DEFAULT 0,
    video_duration_seconds integer DEFAULT 0,
    completed boolean DEFAULT false,
    replayed boolean DEFAULT false,
    replay_count integer DEFAULT 0,
    ip_hash text,
    ended_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_scores (
    video_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
    total_watch_time integer DEFAULT 0,
    total_likes integer DEFAULT 0,
    total_comments integer DEFAULT 0,
    total_shares integer DEFAULT 0,
    total_completions integer DEFAULT 0,
    total_views integer DEFAULT 0,
    score integer DEFAULT 0,
    test_group_views integer DEFAULT 0,
    test_group_engagement numeric DEFAULT 0,
    distribution_phase text DEFAULT 'test',
    max_reach integer DEFAULT 500,
    test_group_size integer DEFAULT 200,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_interests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL,
    weight numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_not_interested (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_interactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    interaction_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shares (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    platform text,
    created_at timestamptz DEFAULT now()
);

CREATE POLICY "Analytics Insert" ON public.video_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Interests Read" ON public.user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Interests Write" ON public.user_interests FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
    comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.hashtags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag text UNIQUE NOT NULL,
    use_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_hashtags (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

-- 2.5 LIVE / BATTLE
CREATE TABLE IF NOT EXISTS public.lives (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'ended', -- live, ended
    title text,
    cover_url text,
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_viewers (
    live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (live_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.battles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
    host_a uuid NOT NULL REFERENCES auth.users(id),
    host_b uuid NOT NULL REFERENCES auth.users(id),
    status text DEFAULT 'pending', -- pending, active, completed, cancelled
    winner_id uuid REFERENCES auth.users(id),
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.battle_invites (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
    status text DEFAULT 'pending', -- pending, accepted, rejected, expired
    created_at timestamptz DEFAULT now()
);

-- 2.6 GIFTS / COINS
CREATE TABLE IF NOT EXISTS public.coin_balances (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance integer DEFAULT 0,
    test_balance integer DEFAULT 1000, -- Default test coins for demo
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL, -- purchase, gift_sent, gift_received, bonus
    amount integer NOT NULL, -- can be negative
    is_test boolean DEFAULT false,
    ref_id uuid, -- reference to gift_send_id or payment_id
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gifts_catalog (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    icon_url text NOT NULL,
    animation_url text,
    coin_cost integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_sends (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_id uuid REFERENCES public.lives(id) ON DELETE SET NULL,
    post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    gift_id uuid NOT NULL REFERENCES public.gifts_catalog(id),
    amount integer DEFAULT 1, -- quantity
    total_cost integer NOT NULL,
    is_test boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 2.7 CHAT
CREATE TABLE IF NOT EXISTS public.chats (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    type text DEFAULT 'direct', -- direct, group
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
    chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text text,
    media_url text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS) & POLICIES
-- =====================================================

-- Helper to enable RLS on a table
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    LOOP 
        EXECUTE 'ALTER TABLE public.' || t || ' ENABLE ROW LEVEL SECURITY'; 
    END LOOP; 
END $$;

-- 3.1 PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 3.2 POSTS
CREATE POLICY "Public posts are viewable by everyone" ON public.posts FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- 3.3 LIKES & COMMENTS
CREATE POLICY "Public likes viewable" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public comments viewable" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- 3.4 SOCIAL
CREATE POLICY "Public follows viewable" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- 3.5 CHAT (Strict)
CREATE POLICY "Members can view chat messages" ON public.messages FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid()));

CREATE POLICY "Members can send messages" ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid()));

CREATE POLICY "Members can view chats" ON public.chats FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = id AND user_id = auth.uid()));

-- 3.6 STORAGE POLICIES (Crucial)
-- We target storage.objects

-- AVATARS (Public Read, Owner Write)
CREATE POLICY "Avatars Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatars Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Avatars Owner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Avatars Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

-- POSTS (Public Read, Owner Write)
CREATE POLICY "Posts Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Posts Owner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[2] = auth.uid()::text);

-- GIFTS (Public Read, Admin Write - assuming admin check or permissive for now)
CREATE POLICY "Gifts Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'gifts');
-- Allow authenticated upload for now (for setup), strictly should be admin
CREATE POLICY "Gifts Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gifts' AND auth.role() = 'authenticated');

-- CHAT MEDIA (Private, Chat Member Read)
-- This is complex in storage policies. Simplified: Sender can access.
CREATE POLICY "Chat Media Sender Access" ON storage.objects FOR ALL USING (bucket_id = 'chat_media' AND (storage.foldername(name))[2] = auth.uid()::text);

-- =====================================================
-- 4. FUNCTIONS & TRIGGERS
-- =====================================================

-- Handle New User -> Create Profile & Coin Balance
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  INSERT INTO public.coin_balances (user_id, balance, test_balance)
  VALUES (NEW.id, 0, 1000);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Send Gift Function (Transaction)
CREATE OR REPLACE FUNCTION public.send_gift(
  p_gift_id uuid,
  p_receiver_id uuid,
  p_live_id uuid DEFAULT NULL,
  p_post_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_cost integer;
  v_sender_balance integer;
  v_gift_name text;
BEGIN
  -- Get gift cost
  SELECT coin_cost, name INTO v_cost, v_gift_name FROM public.gifts_catalog WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;

  -- Check balance
  SELECT test_balance INTO v_sender_balance FROM public.coin_balances WHERE user_id = auth.uid();
  IF v_sender_balance < v_cost THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  -- Deduct
  UPDATE public.coin_balances SET test_balance = test_balance - v_cost WHERE user_id = auth.uid();
  
  -- Add to receiver (optional logic for earnings)
  -- UPDATE public.coin_balances SET test_balance = test_balance + (v_cost / 2) WHERE user_id = p_receiver_id;

  -- Record Send
  INSERT INTO public.gift_sends (live_id, post_id, sender_id, receiver_id, gift_id, total_cost, is_test)
  VALUES (p_live_id, p_post_id, auth.uid(), p_receiver_id, p_gift_id, v_cost, true);

  RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance - v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. INITIAL DATA
-- =====================================================
INSERT INTO public.gifts_catalog (name, icon_url, coin_cost, animation_url) VALUES
('Rose', 'https://emojicdn.elk.sh/🌹', 1, 'rose.json'),
('Heart', 'https://emojicdn.elk.sh/❤️', 5, 'heart.json'),
('Rocket', 'https://emojicdn.elk.sh/🚀', 100, 'rocket.json')
ON CONFLICT DO NOTHING;
