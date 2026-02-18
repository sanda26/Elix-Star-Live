-- Robust handle_new_user trigger to fix "Database error creating new user"
-- Run this in Supabase Dashboard -> SQL Editor

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  new_username text;
  counter integer := 0;
BEGIN
  -- 1. Determine a base username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1),
    'user_' || floor(random() * 1000000)::text
  );
  
  -- Clean the username (lowercase, remove spaces, special chars)
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  
  -- If base_username became empty after cleaning, use a default
  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  new_username := base_username;

  -- 2. Try to insert, appending numbers if unique constraint fails
  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, username, display_name, avatar_url, coins, level, xp)
      VALUES (
        NEW.id,
        new_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', new_username),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        0, -- Default coins
        1, -- Default level
        0  -- Default XP
      );
      EXIT; -- Success, break loop
    EXCEPTION WHEN unique_violation THEN
      counter := counter + 1;
      -- Append a random number for uniqueness
      new_username := base_username || floor(random() * 10000)::text;
      
      -- Safety valve to prevent infinite loops (unlikely but good practice)
      IF counter > 10 THEN
        RAISE EXCEPTION 'Could not generate unique username after 10 attempts for user %', NEW.id;
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
