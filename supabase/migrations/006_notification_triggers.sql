-- ═══════════════════════════════════════════════════════════════
-- Auto-create notifications for social actions via DB triggers
-- ═══════════════════════════════════════════════════════════════

-- Helper: create a notification row
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  -- Don't notify yourself
  IF p_user_id = (p_data->>'actor_id')::uuid THEN RETURN; END IF;
  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (p_user_id, p_type, p_title, p_body, p_data, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ LIKE notification ═══
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS trigger AS $$
DECLARE
  v_video RECORD;
  v_actor RECORD;
BEGIN
  SELECT user_id INTO v_video FROM videos WHERE id = NEW.video_id;
  IF v_video.user_id IS NULL OR v_video.user_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_actor FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    v_video.user_id,
    'like',
    'New Like',
    '@' || COALESCE(v_actor.username, 'Someone') || ' liked your video',
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'video_id', NEW.video_id,
      'action_url', '/video/' || NEW.video_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_like ON likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- ═══ COMMENT notification ═══
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS trigger AS $$
DECLARE
  v_video RECORD;
  v_actor RECORD;
BEGIN
  SELECT user_id INTO v_video FROM videos WHERE id = NEW.video_id;
  IF v_video.user_id IS NULL OR v_video.user_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_actor FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    v_video.user_id,
    'comment',
    'New Comment',
    '@' || COALESCE(v_actor.username, 'Someone') || ' commented: ' || LEFT(NEW.text, 50),
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'video_id', NEW.video_id,
      'comment_id', NEW.id,
      'action_url', '/video/' || NEW.video_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- ═══ FOLLOW notification ═══
CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS trigger AS $$
DECLARE
  v_actor RECORD;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_actor FROM profiles WHERE user_id = NEW.follower_id;

  PERFORM create_notification(
    NEW.following_id,
    'follow',
    'New Follower',
    '@' || COALESCE(v_actor.username, 'Someone') || ' started following you',
    jsonb_build_object(
      'actor_id', NEW.follower_id,
      'action_url', '/profile/' || NEW.follower_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_follow ON followers;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON followers
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- ═══ GIFT notification (on gift_transactions) ═══
CREATE OR REPLACE FUNCTION notify_on_gift() RETURNS trigger AS $$
DECLARE
  v_sender RECORD;
BEGIN
  IF NEW.receiver_id IS NULL OR NEW.receiver_id = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_sender FROM profiles WHERE user_id = NEW.sender_id;

  PERFORM create_notification(
    NEW.receiver_id,
    'gift',
    'Gift Received',
    '@' || COALESCE(v_sender.username, 'Someone') || ' sent you a gift!',
    jsonb_build_object(
      'actor_id', NEW.sender_id,
      'gift_id', NEW.gift_id,
      'coins', NEW.coins
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_gift ON gift_transactions;
CREATE TRIGGER trg_notify_gift
  AFTER INSERT ON gift_transactions
  FOR EACH ROW EXECUTE FUNCTION notify_on_gift();
