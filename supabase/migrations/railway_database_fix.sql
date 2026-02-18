-- RAILWAY DATABASE FIX - Complete Schema Migration
-- Run this in Supabase Dashboard -> SQL Editor for Railway project

-- ==========================================
-- 1. FIX MISSING COLUMNS
-- ==========================================

-- Fix videos table - add missing is_private column
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Fix gifts_catalog table - add missing price column  
ALTER TABLE public.gifts_catalog 
ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;

-- Fix live_streams table - add missing thumbnail_url column
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ==========================================
-- 2. CREATE MISSING TABLES
-- ==========================================

-- Create camera_filters table
CREATE TABLE IF NOT EXISTS public.camera_filters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    filter_type TEXT NOT NULL, -- 'beauty', 'color', 'effect'
    intensity REAL DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.camera_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view camera filters" ON public.camera_filters FOR SELECT USING (true);
GRANT SELECT ON public.camera_filters TO anon;
GRANT ALL ON public.camera_filters TO authenticated;

-- Create speed_options table
CREATE TABLE IF NOT EXISTS public.speed_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    speed_multiplier REAL NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.speed_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view speed options" ON public.speed_options FOR SELECT USING (true);
GRANT SELECT ON public.speed_options TO anon;
GRANT ALL ON public.speed_options TO authenticated;

-- Create sound_library table
CREATE TABLE IF NOT EXISTS public.sound_library (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT,
    url TEXT NOT NULL,
    duration_seconds INTEGER,
    genre TEXT,
    is_active BOOLEAN DEFAULT true,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sound_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sound library" ON public.sound_library FOR SELECT USING (true);
GRANT SELECT ON public.sound_library TO anon;
GRANT ALL ON public.sound_library TO authenticated;

-- Create sticker_options table
CREATE TABLE IF NOT EXISTS public.sticker_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sticker_url TEXT NOT NULL,
    category TEXT NOT NULL, -- 'emoji', 'text', 'graphic'
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sticker_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sticker options" ON public.sticker_options FOR SELECT USING (true);
GRANT SELECT ON public.sticker_options TO anon;
GRANT ALL ON public.sticker_options TO authenticated;

-- ==========================================
-- 3. INSERT DEFAULT DATA
-- ==========================================

-- Insert default speed options
INSERT INTO public.speed_options (speed_multiplier, display_name, icon, sort_order) VALUES
(0.5, '0.5x', '🐌', 1),
(1.0, '1x', '⏱️', 2),
(1.5, '1.5x', '🚶', 3),
(2.0, '2x', '🏃', 4),
(3.0, '3x', '🏃‍♂️', 5)
ON CONFLICT DO NOTHING;

-- Insert default camera filters
INSERT INTO public.camera_filters (name, filter_type, intensity, sort_order) VALUES
('Natural', 'beauty', 0.3, 1),
('Smooth', 'beauty', 0.5, 2),
('Glow', 'beauty', 0.7, 3),
('Vintage', 'color', 0.5, 4),
('Black & White', 'color', 1.0, 5),
('Warm', 'color', 0.3, 6)
ON CONFLICT DO NOTHING;

-- Insert default sound tracks
INSERT INTO public.sound_library (title, artist, url, duration_seconds, genre) VALUES
('Upbeat Background', 'Elix Library', '/sounds/upbeat.mp3', 30, 'pop'),
('Chill Vibes', 'Elix Library', '/sounds/chill.mp3', 45, 'ambient'),
('Epic Moment', 'Elix Library', '/sounds/epic.mp3', 60, 'cinematic'),
('Happy Beat', 'Elix Library', '/sounds/happy.mp3', 30, 'dance'),
('Romantic', 'Elix Library', '/sounds/romantic.mp3', 40, 'romantic')
ON CONFLICT DO NOTHING;

-- Insert default stickers
INSERT INTO public.sticker_options (name, sticker_url, category, sort_order) VALUES
('Heart', '/stickers/heart.png', 'emoji', 1),
('Star', '/stickers/star.png', 'emoji', 2),
('Fire', '/stickers/fire.png', 'emoji', 3),
('Love', '/stickers/love.png', 'text', 4),
('Wow', '/stickers/wow.png', 'text', 5),
('Cool', '/stickers/cool.png', 'graphic', 6)
ON CONFLICT DO NOTHING;

-- ==========================================
-- 4. UPDATE EXISTING DATA
-- ==========================================

-- Update existing videos to have is_private = false
UPDATE public.videos 
SET is_private = false 
WHERE is_private IS NULL;

-- Update existing gifts to have default price
UPDATE public.gifts_catalog 
SET price = COALESCE(price, 100) 
WHERE price IS NULL OR price = 0;

-- ==========================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS camera_filters_active_idx ON public.camera_filters(is_active);
CREATE INDEX IF NOT EXISTS speed_options_active_idx ON public.speed_options(is_active);
CREATE INDEX IF NOT EXISTS sound_library_active_idx ON public.sound_library(is_active);
CREATE INDEX IF NOT EXISTS sticker_options_active_idx ON public.sticker_options(is_active);
CREATE INDEX IF NOT EXISTS sound_library_genre_idx ON public.sound_library(genre);
CREATE INDEX IF NOT EXISTS sticker_options_category_idx ON public.sticker_options(category);

-- ==========================================
-- 6. VERIFICATION
-- ==========================================

-- Check if all columns exist
DO $$
BEGIN
    -- Check videos.is_private
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='is_private') THEN
        RAISE EXCEPTION 'videos.is_private column still missing';
    END IF;
    
    -- Check gifts_catalog.price
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gifts_catalog' AND column_name='price') THEN
        RAISE EXCEPTION 'gifts_catalog.price column still missing';
    END IF;
    
    -- Check live_streams.thumbnail_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='live_streams' AND column_name='thumbnail_url') THEN
        RAISE EXCEPTION 'live_streams.thumbnail_url column still missing';
    END IF;
    
    RAISE NOTICE 'All required columns exist';
END $$;

-- Check if all tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='camera_filters') THEN
        RAISE EXCEPTION 'camera_filters table still missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='speed_options') THEN
        RAISE EXCEPTION 'speed_options table still missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sound_library') THEN
        RAISE EXCEPTION 'sound_library table still missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sticker_options') THEN
        RAISE EXCEPTION 'sticker_options table still missing';
    END IF;
    
    RAISE NOTICE 'All required tables exist';
END $$;

SELECT 'Railway Database Schema Fix Complete' as status;