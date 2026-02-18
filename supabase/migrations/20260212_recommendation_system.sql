CREATE TABLE IF NOT EXISTS video_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  watch_time_seconds real NOT NULL DEFAULT 0,
  video_duration_seconds real NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  replayed boolean NOT NULL DEFAULT false,
  replay_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_hash text,
  device_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_views_user ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_created ON video_views(created_at DESC);

CREATE TABLE IF NOT EXISTS shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  platform text DEFAULT 'copy',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_video ON shares(video_id);
CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  text text NOT NULL,
  parent_id uuid,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

CREATE TABLE IF NOT EXISTS video_scores (
  video_id uuid PRIMARY KEY,
  total_watch_time real NOT NULL DEFAULT 0,
  total_likes integer NOT NULL DEFAULT 0,
  total_comments integer NOT NULL DEFAULT 0,
  total_shares integer NOT NULL DEFAULT 0,
  total_completions integer NOT NULL DEFAULT 0,
  total_views integer NOT NULL DEFAULT 0,
  score real NOT NULL DEFAULT 0,
  test_group_size integer NOT NULL DEFAULT 300,
  test_group_views integer NOT NULL DEFAULT 0,
  test_group_engagement real NOT NULL DEFAULT 0,
  distribution_phase text NOT NULL DEFAULT 'test',
  max_reach integer NOT NULL DEFAULT 300,
  category text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_interests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category text NOT NULL,
  weight real NOT NULL DEFAULT 1.0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);

CREATE TABLE IF NOT EXISTS abuse_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  ip_hash text,
  action text NOT NULL,
  video_id uuid,
  flagged boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abuse_log_user ON abuse_log(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_log_ip ON abuse_log(ip_hash);

ALTER TABLE videos ADD COLUMN IF NOT EXISTS engagement_score real DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_eligible_for_fyp boolean DEFAULT true;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS shares_count integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds real DEFAULT 0;

CREATE TABLE IF NOT EXISTS likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

CREATE TABLE IF NOT EXISTS followers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);

CREATE TABLE IF NOT EXISTS video_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  interaction_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_interactions_user ON video_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_interactions_video ON video_interactions(video_id);

CREATE TABLE IF NOT EXISTS video_hashtags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL,
  hashtag text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_hashtags_video ON video_hashtags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_hashtags_hashtag ON video_hashtags(hashtag);

CREATE TABLE IF NOT EXISTS user_not_interested (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);
