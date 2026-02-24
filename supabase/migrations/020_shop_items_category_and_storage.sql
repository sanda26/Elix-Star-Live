-- Add category to shop_items (app expects it for filters)
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

-- Ensure shop-images bucket is usable: allow authenticated users to upload in their folder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-images', 'shop-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DROP POLICY IF EXISTS "shop-images SELECT" ON storage.objects;
DROP POLICY IF EXISTS "shop-images INSERT" ON storage.objects;
DROP POLICY IF EXISTS "shop-images UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "shop-images DELETE" ON storage.objects;

CREATE POLICY "shop-images SELECT" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-images');

CREATE POLICY "shop-images INSERT" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shop-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'shop'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "shop-images UPDATE" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'shop-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'shop'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "shop-images DELETE" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'shop-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'shop'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
