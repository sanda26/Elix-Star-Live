
-- ==========================================
-- SYNC AUTH.USERS TO PUBLIC.USERS
-- ==========================================

-- The 'videos' table references 'public.users', so we must ensure all auth users exist there.

INSERT INTO public.users (id, email, username, password_hash, avatar_url, created_at, updated_at)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  'managed_by_supabase_auth', -- Dummy hash since we use Supabase Auth
  au.raw_user_meta_data->>'avatar_url',
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Also fix RLS on public.users just in case
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow public read
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
CREATE POLICY "Public users are viewable by everyone" 
ON public.users FOR SELECT 
USING (true);

-- Allow users to update their own record
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

-- Allow users to insert their own record (if not exists)
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
CREATE POLICY "Users can insert own record" 
ON public.users FOR INSERT 
WITH CHECK (auth.uid() = id);

