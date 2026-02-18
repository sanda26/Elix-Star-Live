-- Stream Management Tables Migration
-- Run these in Supabase Dashboard -> SQL Editor

-- 1) Stream Keys Table
CREATE TABLE IF NOT EXISTS stream_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_key text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

-- 2) Stream Recordings Table
CREATE TABLE IF NOT EXISTS stream_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_url text NOT NULL,
  thumbnail_url text,
  duration integer NOT NULL, -- in seconds
  file_size bigint, -- in bytes
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) Stream Analytics Table
CREATE TABLE IF NOT EXISTS stream_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  viewer_count integer DEFAULT 0,
  gift_count integer DEFAULT 0,
  coins_earned integer DEFAULT 0,
  peak_viewers integer DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stream_keys_user_id ON stream_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_keys_stream_key ON stream_keys(stream_key);
CREATE INDEX IF NOT EXISTS idx_stream_keys_active ON stream_keys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_stream_recordings_user_id ON stream_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_stream_id ON stream_recordings(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_created_at ON stream_recordings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_recorded_at ON stream_analytics(recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE stream_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_keys
CREATE POLICY "Users can view own stream keys" ON stream_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stream keys" ON stream_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stream keys" ON stream_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stream keys" ON stream_keys FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for stream_recordings
CREATE POLICY "Users can view own stream recordings" ON stream_recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stream recordings" ON stream_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stream recordings" ON stream_recordings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stream recordings" ON stream_recordings FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for stream_analytics
CREATE POLICY "Stream hosts can view own analytics" ON stream_analytics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM live_streams 
    WHERE live_streams.id = stream_analytics.stream_id 
    AND live_streams.host_id = auth.uid()
  )
);
CREATE POLICY "System can insert analytics" ON stream_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update analytics" ON stream_analytics FOR UPDATE USING (true);

-- Function to validate stream key
CREATE OR REPLACE FUNCTION validate_stream_key(p_stream_key text)
RETURNS TABLE (
  valid boolean,
  user_id uuid
) AS $$
DECLARE
  key_user_id uuid;
BEGIN
  SELECT user_id INTO key_user_id
  FROM stream_keys
  WHERE stream_key = p_stream_key
  AND is_active = true;
  
  IF key_user_id IS NOT NULL THEN
    -- Update last used timestamp
    UPDATE stream_keys
    SET last_used_at = now()
    WHERE stream_key = p_stream_key;
    
    RETURN QUERY SELECT true, key_user_id;
  ELSE
    RETURN QUERY SELECT false, NULL::uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_stream_key TO authenticated;
GRANT EXECUTE ON FUNCTION validate_stream_key TO anon;

-- Storage bucket for stream recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stream-recordings', 
  'stream-recordings', 
  false, -- Private bucket
  5368709120, -- 5GB limit per file
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- RLS for storage bucket
CREATE POLICY "Users can upload own stream recordings" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'stream-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own stream recordings" ON storage.objects FOR SELECT USING (
  bucket_id = 'stream-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own stream recordings" ON storage.objects FOR UPDATE USING (
  bucket_id = 'stream-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own stream recordings" ON storage.objects FOR DELETE USING (
  bucket_id = 'stream-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- DONE! Stream management tables and functions are ready
-- =====================================================