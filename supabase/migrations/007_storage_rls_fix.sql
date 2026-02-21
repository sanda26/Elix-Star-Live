-- ═══════════════════════════════════════════════════════════════
-- Fix Storage RLS: restrict file operations to owner's folder
-- Before: any authenticated user could delete/overwrite any file
-- After: users can only modify files in their own folder (userId/*)
-- ═══════════════════════════════════════════════════════════════

-- user-content bucket (videos, thumbnails)
DROP POLICY IF EXISTS "user-content INSERT" ON storage.objects;
DROP POLICY IF EXISTS "user-content UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "user-content DELETE" ON storage.objects;
DROP POLICY IF EXISTS "user-content SELECT" ON storage.objects;

CREATE POLICY "user-content SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-content');

CREATE POLICY "user-content INSERT" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-content'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user-content UPDATE" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-content'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user-content DELETE" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-content'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars bucket
DROP POLICY IF EXISTS "avatars INSERT" ON storage.objects;
DROP POLICY IF EXISTS "avatars UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "avatars DELETE" ON storage.objects;
DROP POLICY IF EXISTS "avatars SELECT" ON storage.objects;

CREATE POLICY "avatars SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars INSERT" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars UPDATE" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars DELETE" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
