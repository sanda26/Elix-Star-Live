-- Store actor avatar and username in like/comment notification data so Activity can show who liked/commented

-- ═══ LIKE notification (include actor avatar + username in data) ═══
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS trigger AS $$
DECLARE
  v_video RECORD;
  v_actor RECORD;
BEGIN
  SELECT user_id INTO v_video FROM videos WHERE id = NEW.video_id;
  IF v_video.user_id IS NULL OR v_video.user_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, display_name, avatar_url INTO v_actor FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    v_video.user_id,
    'like',
    'New Like',
    '@' || COALESCE(v_actor.username, 'Someone') || ' liked your video',
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'video_id', NEW.video_id,
      'action_url', '/video/' || NEW.video_id,
      'avatar_url', v_actor.avatar_url,
      'actor_username', COALESCE(v_actor.username, ''),
      'actor_display_name', v_actor.display_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ COMMENT notification (include actor avatar + username in data) ═══
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS trigger AS $$
DECLARE
  v_video RECORD;
  v_actor RECORD;
BEGIN
  SELECT user_id INTO v_video FROM videos WHERE id = NEW.video_id;
  IF v_video.user_id IS NULL OR v_video.user_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, display_name, avatar_url INTO v_actor FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    v_video.user_id,
    'comment',
    'New Comment',
    '@' || COALESCE(v_actor.username, 'Someone') || ' commented: ' || LEFT(NEW.text, 50),
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'video_id', NEW.video_id,
      'comment_id', NEW.id,
      'action_url', '/video/' || NEW.video_id,
      'avatar_url', v_actor.avatar_url,
      'actor_username', COALESCE(v_actor.username, ''),
      'actor_display_name', v_actor.display_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
