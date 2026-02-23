-- ═══════════════════════════════════════════════════════════════
-- 1. Admin Audit Log — tracks all admin/system actions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  text NOT NULL DEFAULT 'system',  -- admin, system, webhook
  action      text NOT NULL,                    -- payout_approved, payout_rejected, chargeback_processed, earning_reversed, account_frozen, account_unfrozen, shop_refund, etc.
  target_type text,                             -- user, payout_request, gift_transaction, shop_purchase
  target_id   text,                             -- the ID of the affected record
  details     jsonb DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_select" ON admin_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);
CREATE POLICY "audit_log_service_insert" ON admin_audit_log FOR INSERT WITH CHECK (true);

-- Helper to insert audit entries from RPCs
CREATE OR REPLACE FUNCTION log_audit(
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_audit_log (actor_id, actor_role, action, target_type, target_id, details)
  VALUES (p_actor_id, p_actor_role, p_action, p_target_type, p_target_id, p_details);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Abuse Detection — auto-freeze after X chargebacks
-- ═══════════════════════════════════════════════════════════════

-- Track chargeback count per user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chargeback_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS frozen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS frozen_reason text;

-- RPC: record_chargeback — increments count, auto-freezes at threshold
CREATE OR REPLACE FUNCTION record_chargeback(p_user_id uuid, p_reason text DEFAULT 'store_chargeback')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count integer;
  v_frozen boolean := false;
  v_threshold integer := 3;
BEGIN
  UPDATE profiles
  SET chargeback_count = chargeback_count + 1
  WHERE user_id = p_user_id
  RETURNING chargeback_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF v_new_count >= v_threshold THEN
    UPDATE profiles
    SET is_frozen = true,
        frozen_at = now(),
        frozen_reason = 'Auto-frozen: ' || v_new_count || ' chargebacks detected'
    WHERE user_id = p_user_id AND NOT is_frozen;

    v_frozen := true;

    PERFORM log_audit(
      NULL, 'system', 'account_frozen', 'user', p_user_id::text,
      jsonb_build_object('reason', p_reason, 'chargeback_count', v_new_count)
    );
  END IF;

  PERFORM log_audit(
    NULL, 'webhook', 'chargeback_recorded', 'user', p_user_id::text,
    jsonb_build_object('reason', p_reason, 'new_count', v_new_count, 'frozen', v_frozen)
  );

  RETURN json_build_object('chargeback_count', v_new_count, 'frozen', v_frozen);
END;
$$;

-- RPC: admin_unfreeze_account — manual review complete, unfreeze
CREATE OR REPLACE FUNCTION admin_unfreeze_account(p_user_id uuid, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE user_id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE profiles
  SET is_frozen = false, frozen_at = NULL, frozen_reason = NULL
  WHERE user_id = p_user_id;

  PERFORM log_audit(
    v_admin_id, 'admin', 'account_unfrozen', 'user', p_user_id::text,
    jsonb_build_object('note', COALESCE(p_note, ''))
  );

  RETURN json_build_object('unfrozen', true, 'user_id', p_user_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Add audit logging to existing payout RPCs
-- ═══════════════════════════════════════════════════════════════

-- Patch send_stream_gift to block frozen accounts
CREATE OR REPLACE FUNCTION send_stream_gift(p_stream_key text, p_gift_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_gift_cost integer;
  v_current_coins integer;
  v_current_xp integer;
  v_current_level integer;
  v_is_frozen boolean;
  v_new_balance integer;
  v_new_xp integer;
  v_new_level integer;
  v_xp_gain integer;
  v_next_level_xp integer;
  v_tx_id uuid;
  v_receiver_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_gift_cost := CASE p_gift_id
    WHEN 's_rose' THEN 1 WHEN 's_heart' THEN 5 WHEN 's_coffee' THEN 15
    WHEN 's_panda' THEN 10 WHEN 's_butterfly' THEN 25 WHEN 's_cat' THEN 50
    WHEN 's_dog' THEN 100 WHEN 's_sun' THEN 250 WHEN 's_diamond' THEN 300
    WHEN 's_rainbow' THEN 500 WHEN 's_unicorn' THEN 1000 WHEN 's_crown' THEN 1500
    WHEN 'horse_gallop' THEN 5000 WHEN 'rex_dino' THEN 12000
    WHEN 'treasure_chest' THEN 15000 WHEN 'war_bird' THEN 15000
    WHEN 'kitty_treasure' THEN 17000 WHEN 'frost_wolf' THEN 18000
    WHEN 'voyager_ship' THEN 19000 WHEN 'fiery_lion' THEN 21000
    WHEN 'night_panther' THEN 22000 WHEN 'titan_gorilla' THEN 23000
    WHEN 'misty_wolf' THEN 25000 WHEN 'cosmic_panther' THEN 26000
    WHEN 'star_wand' THEN 28000 WHEN 'beast_relic' THEN 31000
    WHEN 'crystal_rhino' THEN 32000 WHEN 'storm_phoenix' THEN 34000
    WHEN 'ice_sorceress' THEN 37000 WHEN 'fire_phoenix' THEN 38000
    WHEN 'lavarok' THEN 40000 WHEN 'blazing_wizard' THEN 42000
    WHEN 'aelyra_flameveil' THEN 45000 WHEN 'golden_lion' THEN 46000
    WHEN 'dragon_egg' THEN 49000 WHEN 'lava_demon' THEN 52000
    WHEN 'dragon_wrath' THEN 55000 WHEN 'flames_royalty' THEN 55000
    WHEN 'fire_unicorn' THEN 55000 WHEN 'thunder_falcon' THEN 58000
    WHEN 'infernal_lion' THEN 60000 WHEN 'fantasy_unicorn' THEN 61000
    WHEN 'sky_guardian' THEN 64000 WHEN 'majestic_bird' THEN 65000
    WHEN 'flame_king' THEN 65000 WHEN 'majestic_phoenix' THEN 70000
    WHEN 'molten_fury' THEN 75000 WHEN 'universe' THEN 80000
    WHEN 'lava_rampage' THEN 80000 WHEN 'guardian_chest' THEN 85000
    WHEN 'storm_warrior' THEN 85000 WHEN 'pink_jet' THEN 88000
    WHEN 'frost_lion' THEN 90000 WHEN 'night_owl' THEN 90000
    WHEN 'drake_cub' THEN 95000 WHEN 'romantic_jet' THEN 99000
    WHEN 'guardian_vault' THEN 100000 WHEN 'elix_gold_universe' THEN 120000
    WHEN 'lightning_hypercar' THEN 150000 WHEN 'global_universe' THEN 1000000
    WHEN 'face_ar_crown' THEN 200 WHEN 'face_ar_glasses' THEN 150
    WHEN 'face_ar_hearts' THEN 100 WHEN 'face_ar_mask' THEN 200
    WHEN 'face_ar_ears' THEN 150 WHEN 'face_ar_stars' THEN 300
    WHEN 'rose' THEN 1 WHEN 'heart' THEN 5 WHEN 'star' THEN 10
    WHEN 'fire' THEN 50 WHEN 'crown' THEN 100 WHEN 'diamond' THEN 500
    WHEN 'rocket' THEN 1000
    ELSE 0
  END;

  IF v_gift_cost <= 0 THEN RAISE EXCEPTION 'Unknown gift: %', p_gift_id; END IF;

  SELECT coins, xp, level, COALESCE(is_frozen, false)
  INTO v_current_coins, v_current_xp, v_current_level, v_is_frozen
  FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_current_coins IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_is_frozen THEN RAISE EXCEPTION 'Account is frozen. Contact support.'; END IF;
  IF v_current_coins < v_gift_cost THEN
    RAISE EXCEPTION 'Insufficient coins. Have: %, Need: %', v_current_coins, v_gift_cost;
  END IF;

  v_new_balance := v_current_coins - v_gift_cost;
  v_xp_gain := LEAST(v_gift_cost, 10000);
  v_new_xp := v_current_xp + v_xp_gain;
  v_new_level := v_current_level;

  LOOP
    v_next_level_xp := v_new_level * 1000;
    EXIT WHEN v_new_xp < v_next_level_xp OR v_new_level >= 300;
    v_new_xp := v_new_xp - v_next_level_xp;
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE profiles SET coins = v_new_balance, xp = v_new_xp, level = v_new_level
  WHERE user_id = v_user_id;

  SELECT user_id INTO v_receiver_id FROM live_streams WHERE stream_key = p_stream_key LIMIT 1;

  INSERT INTO gift_transactions (sender_id, receiver_id, stream_key, gift_id, coins_spent, platform_fee, creator_earning)
  VALUES (v_user_id, v_receiver_id, p_stream_key, p_gift_id, v_gift_cost, 0, 0)
  RETURNING id INTO v_tx_id;

  IF v_receiver_id IS NOT NULL AND v_receiver_id != v_user_id THEN
    PERFORM process_gift_earning(v_tx_id, v_receiver_id, v_gift_cost, 7);
  END IF;

  RETURN json_build_object('new_balance', v_new_balance, 'new_xp', v_new_xp, 'new_level', v_new_level, 'tx_id', v_tx_id);
END;
$$;

-- Patch admin_process_payout to log actions
CREATE OR REPLACE FUNCTION admin_process_payout(
  p_request_id uuid,
  p_action text,
  p_admin_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_request RECORD;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE user_id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO v_request FROM payout_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request IS NULL THEN RAISE EXCEPTION 'Payout request not found'; END IF;
  IF v_request.status != 'pending' AND v_request.status != 'processing' THEN
    RAISE EXCEPTION 'Request already processed (status: %)', v_request.status;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE payout_requests
    SET status = 'paid', processed_by = v_admin_id, processed_at = now(), admin_note = p_admin_note
    WHERE id = p_request_id;

    UPDATE creator_balances
    SET locked_coins = GREATEST(0, locked_coins - v_request.coins_amount),
        total_withdrawn = total_withdrawn + v_request.coins_amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;

    PERFORM log_audit(v_admin_id, 'admin', 'payout_approved', 'payout_request', p_request_id::text,
      jsonb_build_object('user_id', v_request.user_id, 'coins', v_request.coins_amount, 'note', COALESCE(p_admin_note, '')));

  ELSIF p_action = 'reject' THEN
    UPDATE payout_requests
    SET status = 'rejected', processed_by = v_admin_id, processed_at = now(), admin_note = p_admin_note
    WHERE id = p_request_id;

    UPDATE creator_balances
    SET locked_coins = GREATEST(0, locked_coins - v_request.coins_amount),
        available_coins = available_coins + v_request.coins_amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;

    PERFORM log_audit(v_admin_id, 'admin', 'payout_rejected', 'payout_request', p_request_id::text,
      jsonb_build_object('user_id', v_request.user_id, 'coins', v_request.coins_amount, 'note', COALESCE(p_admin_note, '')));

  ELSE
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  RETURN json_build_object('request_id', p_request_id, 'status', p_action || 'd');
END;
$$;

-- Patch reverse_pending_earning to log reversals
CREATE OR REPLACE FUNCTION reverse_pending_earning(p_gift_tx_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ledger RECORD;
BEGIN
  SELECT * INTO v_ledger
  FROM creator_earnings_ledger
  WHERE gift_tx_id = p_gift_tx_id AND status = 'pending'
  FOR UPDATE;

  IF v_ledger IS NULL THEN
    RETURN json_build_object('reversed', false, 'reason', 'No pending earning found for this transaction');
  END IF;

  UPDATE creator_earnings_ledger SET status = 'reversed' WHERE id = v_ledger.id;

  UPDATE creator_balances
  SET pending_coins = GREATEST(0, pending_coins - v_ledger.net_coins),
      total_earned = GREATEST(0, total_earned - v_ledger.net_coins),
      updated_at = now()
  WHERE user_id = v_ledger.creator_id;

  PERFORM log_audit(NULL, 'system', 'earning_reversed', 'gift_transaction', p_gift_tx_id::text,
    jsonb_build_object('creator_id', v_ledger.creator_id, 'coins_reversed', v_ledger.net_coins));

  RETURN json_build_object('reversed', true, 'coins_reversed', v_ledger.net_coins, 'creator_id', v_ledger.creator_id);
END;
$$;
