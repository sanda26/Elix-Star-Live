-- ═══════════════════════════════════════════════════════════════
-- Creator Payout System
-- 70% creator / 30% platform split on all gifts
-- Pending → Available (after hold period) → Locked → Paid
-- ═══════════════════════════════════════════════════════════════

-- 1. Add receiver_id to gift_transactions so we know who earned
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES auth.users(id);
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS platform_fee integer NOT NULL DEFAULT 0;
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS creator_earning integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_gift_transactions_receiver ON gift_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created ON gift_transactions(created_at);

-- 2. Creator balances — single row per creator, three balance buckets
CREATE TABLE IF NOT EXISTS creator_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pending_coins   integer NOT NULL DEFAULT 0,  -- earned but in hold period
  available_coins integer NOT NULL DEFAULT 0,  -- withdrawable
  locked_coins    integer NOT NULL DEFAULT 0,  -- locked during payout processing
  total_earned    integer NOT NULL DEFAULT 0,  -- lifetime total
  total_withdrawn integer NOT NULL DEFAULT 0,  -- lifetime withdrawn
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_balances_user ON creator_balances(user_id);
ALTER TABLE creator_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_balances_own_select" ON creator_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "creator_balances_service" ON creator_balances FOR ALL USING (true);

-- 3. Creator earnings ledger — every earning event, immutable log
CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_tx_id      uuid REFERENCES gift_transactions(id),
  type            text NOT NULL DEFAULT 'gift_earning',  -- gift_earning, chargeback_reversal, adjustment
  gross_coins     integer NOT NULL,          -- total gift value
  platform_fee    integer NOT NULL,          -- 30% platform cut
  net_coins       integer NOT NULL,          -- 70% creator earning
  status          text NOT NULL DEFAULT 'pending',  -- pending, available, reversed
  matures_at      timestamptz NOT NULL,      -- when pending becomes available
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_creator ON creator_earnings_ledger(creator_id);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_status ON creator_earnings_ledger(status);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_matures ON creator_earnings_ledger(matures_at);
ALTER TABLE creator_earnings_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "earnings_ledger_own_select" ON creator_earnings_ledger FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "earnings_ledger_service" ON creator_earnings_ledger FOR ALL USING (true);

-- 4. Payout methods — how creators want to be paid
CREATE TABLE IF NOT EXISTS payout_methods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL,             -- paypal, bank_transfer, crypto
  details         jsonb NOT NULL DEFAULT '{}', -- encrypted/hashed payment details
  is_default      boolean NOT NULL DEFAULT false,
  is_verified     boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON payout_methods(user_id);
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_methods_own" ON payout_methods FOR ALL USING (auth.uid() = user_id);

-- 5. Payout requests — withdrawal requests
CREATE TABLE IF NOT EXISTS payout_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method_id uuid REFERENCES payout_methods(id),
  coins_amount    integer NOT NULL,
  status          text NOT NULL DEFAULT 'pending',  -- pending, processing, paid, rejected, cancelled
  admin_note      text,
  processed_by    uuid REFERENCES auth.users(id),
  processed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_requests_own_select" ON payout_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payout_requests_own_insert" ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payout_requests_admin" ON payout_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- ═══════════════════════════════════════════════════════════════
-- RPC: process_gift_earning — called by server after gift is sent
-- Handles 70/30 split, ledger entry, balance update
-- MUST be called with service role key (server-side only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION process_gift_earning(
  p_gift_tx_id uuid,
  p_creator_id uuid,
  p_gross_coins integer,
  p_hold_days integer DEFAULT 7
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_fee integer;
  v_net_coins integer;
  v_matures_at timestamptz;
BEGIN
  -- Calculate 70/30 split
  v_platform_fee := FLOOR(p_gross_coins * 0.30);
  v_net_coins := p_gross_coins - v_platform_fee;
  v_matures_at := now() + (p_hold_days || ' days')::interval;

  -- Update the gift_transactions row with receiver info
  UPDATE gift_transactions
  SET receiver_id = p_creator_id,
      platform_fee = v_platform_fee,
      creator_earning = v_net_coins
  WHERE id = p_gift_tx_id;

  -- Insert ledger entry
  INSERT INTO creator_earnings_ledger (creator_id, gift_tx_id, type, gross_coins, platform_fee, net_coins, status, matures_at)
  VALUES (p_creator_id, p_gift_tx_id, 'gift_earning', p_gross_coins, v_platform_fee, v_net_coins, 'pending', v_matures_at);

  -- Upsert creator balance — add to pending
  INSERT INTO creator_balances (user_id, pending_coins, total_earned, updated_at)
  VALUES (p_creator_id, v_net_coins, v_net_coins, now())
  ON CONFLICT (user_id) DO UPDATE SET
    pending_coins = creator_balances.pending_coins + v_net_coins,
    total_earned = creator_balances.total_earned + v_net_coins,
    updated_at = now();

  RETURN json_build_object(
    'net_coins', v_net_coins,
    'platform_fee', v_platform_fee,
    'matures_at', v_matures_at
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RPC: mature_pending_earnings — moves pending → available
-- Should be called periodically (cron or on balance check)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION mature_pending_earnings(p_creator_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
  v_total_matured integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, creator_id, net_coins
    FROM creator_earnings_ledger
    WHERE status = 'pending'
      AND matures_at <= now()
      AND (p_creator_id IS NULL OR creator_id = p_creator_id)
    ORDER BY matures_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE creator_earnings_ledger SET status = 'available' WHERE id = v_row.id;

    UPDATE creator_balances
    SET pending_coins = GREATEST(0, pending_coins - v_row.net_coins),
        available_coins = available_coins + v_row.net_coins,
        updated_at = now()
    WHERE user_id = v_row.creator_id;

    v_total_matured := v_total_matured + v_row.net_coins;
  END LOOP;

  RETURN v_total_matured;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RPC: request_payout — creator requests withdrawal
-- Locks coins from available balance
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION request_payout(
  p_coins_amount integer,
  p_payout_method_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance RECORD;
  v_request_id uuid;
BEGIN
  IF p_coins_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- First mature any pending earnings
  PERFORM mature_pending_earnings(v_user_id);

  -- Lock the balance row
  SELECT * INTO v_balance FROM creator_balances WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No earnings balance found';
  END IF;

  IF v_balance.available_coins < p_coins_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Available: %, Requested: %', v_balance.available_coins, p_coins_amount;
  END IF;

  -- Move from available to locked
  UPDATE creator_balances
  SET available_coins = available_coins - p_coins_amount,
      locked_coins = locked_coins + p_coins_amount,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Create payout request
  INSERT INTO payout_requests (user_id, payout_method_id, coins_amount, status)
  VALUES (v_user_id, p_payout_method_id, p_coins_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'request_id', v_request_id,
    'coins_amount', p_coins_amount,
    'status', 'pending'
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RPC: admin_process_payout — admin approves or rejects
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_process_payout(
  p_request_id uuid,
  p_action text,  -- 'approve' or 'reject'
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

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

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

  ELSIF p_action = 'reject' THEN
    -- Return locked coins to available
    UPDATE payout_requests
    SET status = 'rejected', processed_by = v_admin_id, processed_at = now(), admin_note = p_admin_note
    WHERE id = p_request_id;

    UPDATE creator_balances
    SET locked_coins = GREATEST(0, locked_coins - v_request.coins_amount),
        available_coins = available_coins + v_request.coins_amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  RETURN json_build_object('request_id', p_request_id, 'status', p_action || 'd');
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RPC: reverse_pending_earning — for chargebacks
-- Only reverses earnings still in 'pending' status
-- ═══════════════════════════════════════════════════════════════
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

  RETURN json_build_object('reversed', true, 'coins_reversed', v_ledger.net_coins, 'creator_id', v_ledger.creator_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Rewrite send_stream_gift to use GIFT_VALUES table lookup
-- and add row locking to prevent race conditions
-- ═══════════════════════════════════════════════════════════════
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
  v_new_balance integer;
  v_new_xp integer;
  v_new_level integer;
  v_xp_gain integer;
  v_next_level_xp integer;
  v_tx_id uuid;
  v_receiver_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Gift price lookup — comprehensive list matching server GIFT_VALUES
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
    -- Face AR gifts
    WHEN 'face_ar_crown' THEN 200 WHEN 'face_ar_glasses' THEN 150
    WHEN 'face_ar_hearts' THEN 100 WHEN 'face_ar_mask' THEN 200
    WHEN 'face_ar_ears' THEN 150 WHEN 'face_ar_stars' THEN 300
    -- Legacy IDs (backwards compat)
    WHEN 'rose' THEN 1 WHEN 'heart' THEN 5 WHEN 'star' THEN 10
    WHEN 'fire' THEN 50 WHEN 'crown' THEN 100 WHEN 'diamond' THEN 500
    WHEN 'rocket' THEN 1000
    ELSE 0
  END;

  IF v_gift_cost <= 0 THEN
    RAISE EXCEPTION 'Unknown gift: %', p_gift_id;
  END IF;

  -- Lock the sender's profile row to prevent race conditions
  SELECT coins, xp, level INTO v_current_coins, v_current_xp, v_current_level
  FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_current_coins IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_current_coins < v_gift_cost THEN
    RAISE EXCEPTION 'Insufficient coins. Have: %, Need: %', v_current_coins, v_gift_cost;
  END IF;

  -- Deduct coins
  v_new_balance := v_current_coins - v_gift_cost;

  -- XP gain = gift cost (capped at 10000 per gift for XP)
  v_xp_gain := LEAST(v_gift_cost, 10000);
  v_new_xp := v_current_xp + v_xp_gain;
  v_new_level := v_current_level;

  -- Level up loop
  LOOP
    v_next_level_xp := v_new_level * 1000;
    EXIT WHEN v_new_xp < v_next_level_xp OR v_new_level >= 150;
    v_new_xp := v_new_xp - v_next_level_xp;
    v_new_level := v_new_level + 1;
  END LOOP;

  -- Update sender profile
  UPDATE profiles SET coins = v_new_balance, xp = v_new_xp, level = v_new_level
  WHERE user_id = v_user_id;

  -- Look up the stream creator
  SELECT user_id INTO v_receiver_id FROM live_streams WHERE stream_key = p_stream_key LIMIT 1;

  -- Insert gift transaction with receiver
  INSERT INTO gift_transactions (sender_id, receiver_id, stream_key, gift_id, coins_spent, platform_fee, creator_earning)
  VALUES (v_user_id, v_receiver_id, p_stream_key, p_gift_id, v_gift_cost, 0, 0)
  RETURNING id INTO v_tx_id;

  -- Process creator earning (70/30 split) if we know the receiver
  IF v_receiver_id IS NOT NULL AND v_receiver_id != v_user_id THEN
    PERFORM process_gift_earning(v_tx_id, v_receiver_id, v_gift_cost, 7);
  END IF;

  RETURN json_build_object(
    'new_balance', v_new_balance,
    'new_xp', v_new_xp,
    'new_level', v_new_level,
    'tx_id', v_tx_id
  );
END;
$$;
