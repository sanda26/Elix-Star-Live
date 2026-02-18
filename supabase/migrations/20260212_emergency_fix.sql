
-- ==========================================
-- EMERGENCY RLS FIX for Storage and Profiles
-- ==========================================

-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. RESET Storage Policies for 'user-content'
-- First, drop all existing policies to clear any "strict" leftovers
DROP POLICY IF EXISTS "Allow authenticated uploads to user-content" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read user-content" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Individual user access" ON storage.objects;

-- Now create simple, permissive policies for this bucket
CREATE POLICY "Enable read access for all users"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-content');

CREATE POLICY "Enable insert access for authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-content');

CREATE POLICY "Enable update access for users based on user_id"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-content' AND (auth.uid() = owner OR owner IS NULL));

CREATE POLICY "Enable delete access for users based on user_id"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-content' AND (auth.uid() = owner OR owner IS NULL));

-- 3. FIX Profiles Table RLS
-- Ensure users can insert/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Create missing profiles for existing users (Cleanup)
-- This prevents "Update" failures if the profile is missing
INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;

