-- ============================================================
-- FULL SQL - Safe to run even if parts already exist
-- ============================================================

-- 1. Gift transactions table
CREATE TABLE IF NOT EXISTS gift_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  stream_key text NOT NULL,
  gift_id text NOT NULL,
  coins_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_transactions' AND policyname = 'Users can view own gifts') THEN
    CREATE POLICY "Users can view own gifts" ON gift_transactions FOR SELECT USING (auth.uid() = sender_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_transactions' AND policyname = 'Users can insert own gifts') THEN
    CREATE POLICY "Users can insert own gifts" ON gift_transactions FOR INSERT WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

-- 2. send_stream_gift RPC function
CREATE OR REPLACE FUNCTION send_stream_gift(p_stream_key text, p_gift_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_gift_cost integer;
  v_current_coins integer;
  v_current_level integer;
  v_new_balance integer;
  v_current_xp integer;
  v_new_xp integer;
  v_new_level integer;
  v_xp_needed integer;
BEGIN
  v_gift_cost := CASE p_gift_id
    WHEN 'rose' THEN 1
    WHEN 'heart' THEN 5
    WHEN 'star' THEN 10
    WHEN 'fire' THEN 50
    WHEN 'crown' THEN 100
    WHEN 'diamond' THEN 500
    WHEN 'rocket' THEN 1000
    WHEN 'universe' THEN 5000
    WHEN 'face_ar_mask' THEN 200
    WHEN 'face_ar_ears' THEN 150
    WHEN 'face_ar_stars' THEN 300
    ELSE 1
  END;

  SELECT coins, xp, level INTO v_current_coins, v_current_xp, v_current_level
  FROM profiles WHERE user_id = v_user_id;

  IF v_current_coins IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_current_coins < v_gift_cost THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  v_new_balance := v_current_coins - v_gift_cost;
  v_new_xp := COALESCE(v_current_xp, 0) + v_gift_cost;
  v_new_level := COALESCE(v_current_level, 1);
  
  LOOP
    v_xp_needed := v_new_level * 1000;
    EXIT WHEN v_new_xp < v_xp_needed OR v_new_level >= 300;
    v_new_level := v_new_level + 1;
    v_new_xp := v_new_xp - v_xp_needed;
  END LOOP;

  UPDATE profiles 
  SET coins = v_new_balance, xp = v_new_xp, level = v_new_level
  WHERE user_id = v_user_id;

  INSERT INTO gift_transactions (sender_id, stream_key, gift_id, coins_spent)
  VALUES (v_user_id, p_stream_key, p_gift_id, v_gift_cost);

  RETURN json_build_object(
    'new_balance', v_new_balance,
    'new_xp', v_new_xp,
    'new_level', v_new_level
  );
END;
$$;

-- 3. Increment viewer count
CREATE OR REPLACE FUNCTION increment_viewer_count(p_stream_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE live_streams
  SET viewer_count = COALESCE(viewer_count, 0) + 1
  WHERE stream_key = p_stream_key AND is_live = true;
END;
$$;

-- 4. Decrement viewer count
CREATE OR REPLACE FUNCTION decrement_viewer_count(p_stream_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE live_streams
  SET viewer_count = GREATEST(0, COALESCE(viewer_count, 0) - 1)
  WHERE stream_key = p_stream_key;
END;
$$;

-- 5. Drop old ranking function then recreate
DROP FUNCTION IF EXISTS get_weekly_creator_ranking(integer);
DROP FUNCTION IF EXISTS get_weekly_creator_ranking();
CREATE OR REPLACE FUNCTION get_weekly_creator_ranking(p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, total_coins bigint, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gt.sender_id as user_id,
    p.username::text,
    p.display_name::text,
    p.avatar_url::text,
    SUM(gt.coins_spent)::bigint as total_coins,
    ROW_NUMBER() OVER (ORDER BY SUM(gt.coins_spent) DESC)::bigint as rank
  FROM gift_transactions gt
  JOIN profiles p ON p.user_id = gt.sender_id
  WHERE gt.created_at >= date_trunc('week', now())
  GROUP BY gt.sender_id, p.username, p.display_name, p.avatar_url
  ORDER BY total_coins DESC
  LIMIT p_limit;
END;
$$;

-- 6. Make sure live_streams has viewer_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'live_streams' AND column_name = 'viewer_count'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN viewer_count integer DEFAULT 0;
  END IF;
END $$;

-- 7. Enable realtime on live_streams (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_streams;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 8. Fix notifications column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'notifications' AND column_name = 'read'
    ) THEN
      ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
    ELSE
      ALTER TABLE notifications ADD COLUMN is_read boolean DEFAULT false;
    END IF;
  END IF;
END $$;

-- 9. Ensure profiles has needed columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'followers_count') THEN
    ALTER TABLE profiles ADD COLUMN followers_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'following_count') THEN
    ALTER TABLE profiles ADD COLUMN following_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'likes_count') THEN
    ALTER TABLE profiles ADD COLUMN likes_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp') THEN
    ALTER TABLE profiles ADD COLUMN xp integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'level') THEN
    ALTER TABLE profiles ADD COLUMN level integer DEFAULT 1;
  END IF;
END $$;
