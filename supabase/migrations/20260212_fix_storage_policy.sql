
-- 1. Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Give users access to own folder 1we555" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to user-content" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read user-content" ON storage.objects;

-- 3. Create NEW policies (Wide open for authenticated users for now to fix the error)

-- Allow ANY authenticated user to upload to 'user-content' bucket
CREATE POLICY "Allow authenticated uploads to user-content"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'user-content');

-- Allow ANYONE (public) to read from 'user-content' bucket
CREATE POLICY "Allow public read user-content"
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'user-content');

-- Allow users to update their own files
CREATE POLICY "Allow users to update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-content' AND auth.uid() = owner);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-content' AND auth.uid() = owner);
