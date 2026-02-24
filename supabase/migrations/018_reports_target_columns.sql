-- Reports: add columns used by API so report submissions persist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS context_video_id uuid REFERENCES videos(id) ON DELETE SET NULL;

-- Backfill video_id from target_id when target_type = 'video' for existing rows (optional)
-- UPDATE reports SET video_id = target_id::uuid WHERE target_type = 'video' AND target_id IS NOT NULL AND video_id IS NULL;
