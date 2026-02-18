-- Notification Preferences Table Migration
-- Run these in Supabase Dashboard -> SQL Editor

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT false,
  follow_notifications boolean DEFAULT true,
  like_notifications boolean DEFAULT true,
  comment_notifications boolean DEFAULT true,
  mention_notifications boolean DEFAULT true,
  gift_notifications boolean DEFAULT true,
  battle_notifications boolean DEFAULT true,
  live_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification preferences" ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification preferences" ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notification preferences" ON notification_preferences FOR DELETE USING (auth.uid() = user_id);

-- Trigger to automatically create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (
    user_id,
    push_enabled,
    email_enabled,
    follow_notifications,
    like_notifications,
    comment_notifications,
    mention_notifications,
    gift_notifications,
    battle_notifications,
    live_notifications
  ) VALUES (
    NEW.id,
    true,
    false,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Function to check notification preference
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id uuid,
  p_notification_type text
)
RETURNS boolean AS $$
DECLARE
  preference_enabled boolean;
  type_column text;
BEGIN
  -- Convert notification type to column name
  type_column := p_notification_type || '_notifications';
  
  -- Check if user has this notification type enabled
  EXECUTE format('SELECT %I FROM notification_preferences WHERE user_id = $1', type_column)
  INTO preference_enabled
  USING p_user_id;
  
  -- Return true if preference is enabled or if no preference exists (default to enabled)
  RETURN COALESCE(preference_enabled, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION should_send_notification TO authenticated;

-- =====================================================
-- DONE! Notification preferences system is ready
-- =====================================================