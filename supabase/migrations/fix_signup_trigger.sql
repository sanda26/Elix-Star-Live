-- FIX: Handle Duplicate Usernames in Signup Trigger
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Update the handle_new_user function to automatically handle duplicate usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  new_username text;
  counter integer := 0;
BEGIN
  -- Get base username from metadata or email
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- Normalize: lowercase, remove spaces/special chars if needed (optional, keeping simple for now)
  
  new_username := base_username;

  -- Loop to find a unique username
  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
      VALUES (
        NEW.id,
        new_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', base_username),
        NEW.raw_user_meta_data->>'avatar_url'
      );
      
      -- If insert succeeds, we are done
      EXIT; 
      
    EXCEPTION WHEN unique_violation THEN
      -- If username exists, append a random number and try again
      counter := counter + 1;
      -- Generate a suffix (e.g., _123)
      new_username := base_username || '_' || floor(random() * 10000)::text;
      
      -- Safety valve to prevent infinite loops (unlikely but good practice)
      IF counter > 20 THEN
        RAISE EXCEPTION 'Could not generate unique username for user %', NEW.id;
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger is attached (Idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
