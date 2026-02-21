-- User consent tracking for Terms of Service & Privacy Policy (GDPR compliance)
CREATE TABLE IF NOT EXISTS user_consents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,         -- e.g. 'terms_and_privacy'
  version      text NOT NULL,         -- policy version date, e.g. '2026-02-20'
  accepted_at  timestamptz NOT NULL DEFAULT now(),
  ip_address   inet,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents(consent_type);

-- RLS
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consents"
  ON user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);
