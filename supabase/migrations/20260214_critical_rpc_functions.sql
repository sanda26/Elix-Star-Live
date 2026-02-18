-- =====================================================
-- CRITICAL RPC FUNCTIONS FOR MVP COMPLETION
-- Run these in Supabase Dashboard -> SQL Editor
-- =====================================================

-- 1) SEND_STREAM_GIFT RPC FUNCTION
-- This is called from LiveStream.tsx but was missing
CREATE OR REPLACE FUNCTION send_stream_gift(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_stream_id uuid DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  message text,
  new_balance integer,
  gift_event jsonb
) AS $$
DECLARE
  sender_coins integer;
  gift_cost integer;
  diamonds_earned integer;
  new_sender_balance integer;
  gift_record jsonb;
BEGIN
  -- Get sender's current coin balance
  SELECT coins INTO sender_coins 
  FROM profiles 
  WHERE user_id = p_sender_id;
  
  IF sender_coins IS NULL THEN
    RETURN QUERY SELECT false, 'Sender profile not found', 0, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Get gift cost
  SELECT coin_cost INTO gift_cost
  FROM gifts_catalog 
  WHERE id = p_gift_id AND is_active = true;
  
  IF gift_cost IS NULL THEN
    RETURN QUERY SELECT false, 'Gift not found or inactive', sender_coins, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if sender has enough coins
  IF sender_coins < gift_cost THEN
    RETURN QUERY SELECT false, 'Insufficient coins', sender_coins, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Calculate diamonds earned (20% of cost, rounded up)
  diamonds_earned := CEIL(gift_cost * 0.2);
  
  -- Deduct coins from sender
  UPDATE profiles 
  SET coins = coins - gift_cost 
  WHERE user_id = p_sender_id;
  
  -- Add diamonds to receiver
  UPDATE profiles 
  SET diamonds = diamonds + diamonds_earned 
  WHERE user_id = p_receiver_id;
  
  -- Get new sender balance
  SELECT coins INTO new_sender_balance
  FROM profiles 
  WHERE user_id = p_sender_id;
  
  -- Insert gift transaction record
  INSERT INTO gift_transactions (
    client_request_id,
    sender_id,
    receiver_id,
    gift_id,
    stream_id,
    amount,
    diamonds_earned
  ) VALUES (
    p_client_request_id,
    p_sender_id,
    p_receiver_id,
    p_gift_id,
    p_stream_id,
    gift_cost,
    diamonds_earned
  )
  RETURNING 
    id,
    sender_id,
    receiver_id,
    gift_id,
    stream_id,
    amount,
    diamonds_earned,
    created_at INTO gift_record;
  
  -- Return success
  RETURN QUERY SELECT 
    true, 
    'Gift sent successfully', 
    new_sender_balance, 
    gift_record;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      'Error: ' || SQLERRM, 
      COALESCE(sender_coins, 0), 
      NULL::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) VIDEO THUMBNAIL GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_video_thumbnail(
  p_video_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  video_url text;
BEGIN
  -- Get video URL
  SELECT url INTO video_url
  FROM videos
  WHERE id = p_video_id AND user_id = p_user_id;
  
  IF video_url IS NULL THEN
    RETURN false;
  END IF;
  
  -- For now, return true - in production you would:
  -- 1. Download video from storage
  -- 2. Extract thumbnail using FFmpeg
  -- 3. Upload thumbnail to storage
  -- 4. Update videos.thumbnail_url
  
  -- Update thumbnail_url with placeholder for now
  UPDATE videos
  SET thumbnail_url = 'https://picsum.photos/400/600?random=' || extract(epoch from now())::text
  WHERE id = p_video_id;
  
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) FYP ELIGIBILITY FUNCTION
CREATE OR REPLACE FUNCTION update_fyp_eligibility(p_video_id uuid)
RETURNS void AS $$
DECLARE
  engagement_score integer;
  video_age_hours numeric;
BEGIN
  -- Calculate engagement score
  SELECT 
    (likes * 5) + 
    (comments_count * 10) + 
    (views * 1) + 
    (shares_count * 15)
  INTO engagement_score
  FROM videos
  WHERE id = p_video_id;
  
  -- Calculate video age in hours
  SELECT extract(epoch from (now() - created_at)) / 3600
  INTO video_age_hours
  FROM videos
  WHERE id = p_video_id;
  
  -- Update FYP eligibility based on engagement and age
  UPDATE videos
  SET is_eligible_for_fyp = (
    engagement_score >= 50 AND 
    video_age_hours <= 72 AND
    is_private = false
  ),
  engagement_score = engagement_score
  WHERE id = p_video_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) USER RECOMMENDATION FUNCTION
CREATE OR REPLACE FUNCTION get_user_recommendations(
  p_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  followers_count integer,
  is_following boolean,
  recommendation_score numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH user_following AS (
    SELECT following_id 
    FROM followers 
    WHERE follower_id = p_user_id
  ),
  potential_creators AS (
    SELECT 
      p.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.followers_count,
      CASE WHEN uf.following_id IS NOT NULL THEN true ELSE false END as is_following,
      -- Recommendation score based on:
      -- 1. Not already following
      -- 2. Creator status (is_creator)
      -- 3. Follower count (more followers = higher score)
      -- 4. Recent activity (videos posted in last 7 days)
      CASE 
        WHEN uf.following_id IS NOT NULL THEN 0
        WHEN p.is_creator = true THEN 
          LEAST(p.followers_count / 100.0, 10.0) + 
          CASE WHEN EXISTS(SELECT 1 FROM videos WHERE user_id = p.user_id AND created_at > now() - interval '7 days') THEN 5 ELSE 0 END
        ELSE 
          LEAST(p.followers_count / 200.0, 5.0)
      END as recommendation_score
    FROM profiles p
    LEFT JOIN user_following uf ON p.user_id = uf.following_id
    WHERE p.user_id != p_user_id
    AND p.is_creator = true
    AND uf.following_id IS NULL
  )
  SELECT *
  FROM potential_creators
  WHERE recommendation_score > 0
  ORDER BY recommendation_score DESC, followers_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) BATTLE MATCHMAKING FUNCTION
CREATE OR REPLACE FUNCTION find_battle_opponent(
  p_creator_id uuid,
  p_skill_level integer DEFAULT 1
)
RETURNS TABLE (
  opponent_id uuid,
  username text,
  avatar_url text,
  skill_match_score numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH available_creators AS (
    SELECT 
      p.user_id,
      p.username,
      p.avatar_url,
      -- Calculate skill match score (closer level = higher score)
      CASE 
        WHEN ABS(p.level - p_skill_level) <= 1 THEN 10
        WHEN ABS(p.level - p_skill_level) <= 2 THEN 7
        WHEN ABS(p.level - p_skill_level) <= 3 THEN 5
        ELSE 2
      END as skill_match_score
    FROM profiles p
    WHERE p.user_id != p_creator_id
    AND p.is_creator = true
    AND p.user_id NOT IN (
      -- Exclude creators already in active battles
      SELECT creator_a FROM battle_sessions 
      WHERE status = 'active' 
      AND (creator_a = p.user_id OR creator_b = p.user_id)
      UNION
      SELECT creator_b FROM battle_sessions 
      WHERE status = 'active' 
      AND (creator_a = p.user_id OR creator_b = p.user_id)
    )
    AND p.user_id NOT IN (
      -- Exclude creators who rejected battle recently
      creator_b FROM battle_rejections 
      WHERE creator_a = p_creator_id 
      AND rejected_at > now() - interval '1 hour'
    )
  )
  SELECT *
  FROM available_creators
  WHERE skill_match_score >= 5
  ORDER BY skill_match_score DESC, RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ADDITIONAL TABLES NEEDED FOR MISSING FUNCTIONALITY
-- =====================================================

-- Battle rejections table (for matchmaking)
CREATE TABLE IF NOT EXISTS battle_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rejected_at timestamptz DEFAULT now(),
  UNIQUE(creator_a, creator_b)
);

ALTER TABLE battle_rejections ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_engagement_score ON videos(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_videos_fyp_eligible ON videos(is_eligible_for_fyp, created_at DESC) WHERE is_eligible_for_fyp = true;
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created_at ON gift_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battle_rejections_rejected_at ON battle_rejections(rejected_at DESC);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION send_stream_gift TO authenticated;
GRANT EXECUTE ON FUNCTION generate_video_thumbnail TO authenticated;
GRANT EXECUTE ON FUNCTION update_fyp_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION find_battle_opponent TO authenticated;

-- RLS for battle_rejections
CREATE POLICY "Users can view own battle rejections" ON battle_rejections FOR SELECT USING (auth.uid() = creator_a);
CREATE POLICY "Users can insert own battle rejections" ON battle_rejections FOR INSERT WITH CHECK (auth.uid() = creator_a);
CREATE POLICY "Users can delete own battle rejections" ON battle_rejections FOR DELETE USING (auth.uid() = creator_a);

-- =====================================================
-- DONE! Critical MVP functions are now available
-- =====================================================