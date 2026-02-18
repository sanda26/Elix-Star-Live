-- FINAL FIX: Updated Handle New User Trigger with Proper Permissions
-- This replaces the existing trigger to fix signup issues

-- First, drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  new_username text;
  counter integer := 0;
  max_attempts integer := 10;
BEGIN
  -- Get base username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Clean username: remove special chars, limit length
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  base_username := substr(base_username, 1, 20);
  
  new_username := base_username;

  -- Loop to find a unique username
  LOOP
    BEGIN
      -- Insert profile with proper error handling
      INSERT INTO public.profiles (user_id, username, display_name, avatar_url, created_at)
      VALUES (
        NEW.id,
        new_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', base_username),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        NOW()
      );
      
      -- If insert succeeds, we're done
      RETURN NEW;
      
    EXCEPTION WHEN unique_violation THEN
      -- If username exists, append a number and try again
      counter := counter + 1;
      new_username := base_username || '_' || counter::text;
      
      -- Safety valve to prevent infinite loops
      IF counter > max_attempts THEN
        -- Use timestamp as last resort
        new_username := base_username || '_' || extract(epoch from now());
        
        -- Try one more time
        BEGIN
          INSERT INTO public.profiles (user_id, username, display_name, avatar_url, created_at)
          VALUES (
            NEW.id,
            new_username,
            COALESCE(NEW.raw_user_meta_data->>'full_name', base_username),
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
            NOW()
          );
          RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
          -- If still fails, raise with helpful message
          RAISE EXCEPTION 'Could not create profile for user %: %', NEW.id, SQLERRM;
        END;
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();