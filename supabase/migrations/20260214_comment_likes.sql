-- Comment Likes Table Migration
-- Run these in Supabase Dashboard -> SQL Editor

-- Create comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created_at ON comment_likes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment_likes
CREATE POLICY "Users can view own comment likes" ON comment_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comment likes" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comment likes" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Function to get comment like count
CREATE OR REPLACE FUNCTION get_comment_like_count(p_comment_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM comment_likes
    WHERE comment_id = p_comment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user liked comment
CREATE OR REPLACE FUNCTION is_comment_liked(p_comment_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM comment_likes
    WHERE comment_id = p_comment_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_comment_like_count TO authenticated;
GRANT EXECUTE ON FUNCTION is_comment_liked TO authenticated;

-- =====================================================
-- DONE! Comment threading and likes are ready
-- =====================================================