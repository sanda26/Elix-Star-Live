-- ═══════════════════════════════════════════════════════════════
-- Live AI moderation: log all checks and actions for review
-- Enforcement: first = warning, repeated = pause, serious/repeat = freeze
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS live_moderation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_key  text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,   -- 'check' | 'flag' | 'warning' | 'pause' | 'suspend'
  category    text,            -- e.g. driving_while_live, dangerous_stunt, self_harm_encouragement
  severity    text,            -- 'low' | 'medium' | 'high' | 'critical'
  action_taken text NOT NULL,  -- 'none' | 'warning' | 'pause' | 'suspend'
  details     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_moderation_log_user ON live_moderation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_live_moderation_log_stream ON live_moderation_log(stream_key);
CREATE INDEX IF NOT EXISTS idx_live_moderation_log_created ON live_moderation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_live_moderation_log_kind ON live_moderation_log(kind);

ALTER TABLE live_moderation_log ENABLE ROW LEVEL SECURITY;

-- Only service role / admin can read moderation log
CREATE POLICY "live_moderation_log_admin_select" ON live_moderation_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);
CREATE POLICY "live_moderation_log_service_insert" ON live_moderation_log FOR INSERT WITH CHECK (true);

-- RPC: freeze account for moderation (called by backend only)
CREATE OR REPLACE FUNCTION freeze_account_moderation(p_user_id uuid, p_reason text DEFAULT 'Live moderation: policy violation')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET is_frozen = true,
      frozen_at = now(),
      frozen_reason = COALESCE(p_reason, 'Live moderation: policy violation')
  WHERE user_id = p_user_id;

  PERFORM log_audit(
    NULL, 'system', 'account_frozen_moderation', 'user', p_user_id::text,
    jsonb_build_object('reason', COALESCE(p_reason, ''))
  );

  RETURN json_build_object('frozen', true, 'user_id', p_user_id);
END;
$$;
