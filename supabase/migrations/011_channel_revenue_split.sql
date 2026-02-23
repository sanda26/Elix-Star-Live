-- ═══════════════════════════════════════════════════════════════
-- Channel-aware revenue split
-- Creator ALWAYS gets 70% of net (after store fee). Platform gets 30% of net.
--
-- iOS:     Apple takes ~30% first → net = 70% → Creator 70% of net = 49% of gross
-- Android: Google takes ~15% first → net = 85% → Creator 70% of net = 59.5% of gross
-- Web:     No store fee → net = 100% → Creator 70%, Platform 30%
-- ═══════════════════════════════════════════════════════════════

-- Add channel tracking columns
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS purchase_channel text NOT NULL DEFAULT 'web';
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS store_fee integer NOT NULL DEFAULT 0;

ALTER TABLE creator_earnings_ledger ADD COLUMN IF NOT EXISTS purchase_channel text NOT NULL DEFAULT 'web';
ALTER TABLE creator_earnings_ledger ADD COLUMN IF NOT EXISTS store_fee integer NOT NULL DEFAULT 0;

-- Rewrite process_gift_earning with channel-aware split
CREATE OR REPLACE FUNCTION process_gift_earning(
  p_gift_tx_id uuid,
  p_creator_id uuid,
  p_gross_coins integer,
  p_hold_days integer DEFAULT 7,
  p_channel text DEFAULT 'web'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_fee_pct numeric;
  v_creator_pct numeric;
  v_store_fee integer;
  v_net_after_store integer;
  v_creator_coins integer;
  v_platform_fee integer;
  v_matures_at timestamptz;
BEGIN
  -- Determine store fee based on purchase channel
  -- Creator ALWAYS gets 70% of net-after-store-fee
  CASE p_channel
    WHEN 'ios' THEN
      v_store_fee_pct := 0.30;   -- Apple takes 30%
    WHEN 'android' THEN
      v_store_fee_pct := 0.15;   -- Google takes 15%
    ELSE
      v_store_fee_pct := 0.00;   -- Web: no store fee
  END CASE;
  v_creator_pct := 0.70;          -- Creator always 70% of net

  v_store_fee := FLOOR(p_gross_coins * v_store_fee_pct);
  v_net_after_store := p_gross_coins - v_store_fee;
  v_creator_coins := FLOOR(v_net_after_store * v_creator_pct);
  v_platform_fee := v_net_after_store - v_creator_coins;
  v_matures_at := now() + (p_hold_days || ' days')::interval;

  -- Update gift_transactions with full breakdown
  UPDATE gift_transactions
  SET receiver_id = p_creator_id,
      purchase_channel = p_channel,
      store_fee = v_store_fee,
      platform_fee = v_platform_fee,
      creator_earning = v_creator_coins
  WHERE id = p_gift_tx_id;

  -- Insert ledger entry with channel info
  INSERT INTO creator_earnings_ledger
    (creator_id, gift_tx_id, type, gross_coins, store_fee, platform_fee, net_coins, purchase_channel, status, matures_at)
  VALUES
    (p_creator_id, p_gift_tx_id, 'gift_earning', p_gross_coins, v_store_fee, v_platform_fee, v_creator_coins, p_channel, 'pending', v_matures_at);

  -- Upsert creator balance
  INSERT INTO creator_balances (user_id, pending_coins, total_earned, updated_at)
  VALUES (p_creator_id, v_creator_coins, v_creator_coins, now())
  ON CONFLICT (user_id) DO UPDATE SET
    pending_coins = creator_balances.pending_coins + v_creator_coins,
    total_earned = creator_balances.total_earned + v_creator_coins,
    updated_at = now();

  RETURN json_build_object(
    'net_coins', v_creator_coins,
    'store_fee', v_store_fee,
    'platform_fee', v_platform_fee,
    'channel', p_channel,
    'matures_at', v_matures_at
  );
END;
$$;

-- Rewrite send_stream_gift to accept and pass purchase channel
CREATE OR REPLACE FUNCTION send_stream_gift(p_stream_key text, p_gift_id text, p_channel text DEFAULT 'web')
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
  v_channel text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Sanitize channel
  v_channel := CASE WHEN p_channel IN ('ios', 'android', 'web') THEN p_channel ELSE 'web' END;

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

  INSERT INTO gift_transactions (sender_id, receiver_id, stream_key, gift_id, coins_spent, purchase_channel, store_fee, platform_fee, creator_earning)
  VALUES (v_user_id, v_receiver_id, p_stream_key, p_gift_id, v_gift_cost, v_channel, 0, 0, 0)
  RETURNING id INTO v_tx_id;

  IF v_receiver_id IS NOT NULL AND v_receiver_id != v_user_id THEN
    PERFORM process_gift_earning(v_tx_id, v_receiver_id, v_gift_cost, 7, v_channel);
  END IF;

  RETURN json_build_object('new_balance', v_new_balance, 'new_xp', v_new_xp, 'new_level', v_new_level, 'tx_id', v_tx_id);
END;
$$;
