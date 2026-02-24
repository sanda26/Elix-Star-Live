-- Duet support: link a video to the original video it was duetted with
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duet_with_video_id uuid REFERENCES videos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_videos_duet_with ON videos(duet_with_video_id) WHERE duet_with_video_id IS NOT NULL;
