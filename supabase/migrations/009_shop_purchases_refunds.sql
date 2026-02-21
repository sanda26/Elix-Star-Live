-- ═══════════════════════════════════════════════════════════════
-- Shop Item Purchases & Refund System
-- Shop items are the ONLY refundable product (if unused, within 14 days)
-- ═══════════════════════════════════════════════════════════════

-- Shop item purchases
CREATE TABLE IF NOT EXISTS shop_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  seller_id       uuid NOT NULL REFERENCES auth.users(id),
  coins_paid      integer NOT NULL,
  status          text NOT NULL DEFAULT 'completed',  -- completed, refunded, disputed
  is_used         boolean NOT NULL DEFAULT false,
  refund_eligible boolean NOT NULL DEFAULT true,
  refund_deadline timestamptz,  -- 14 days from purchase
  refunded_at     timestamptz,
  refund_reason   text,
  refunded_by     uuid REFERENCES auth.users(id),  -- admin who processed
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer ON shop_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_seller ON shop_purchases(seller_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_item ON shop_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_status ON shop_purchases(status);
ALTER TABLE shop_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_purchases_own_select" ON shop_purchases FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "shop_purchases_insert" ON shop_purchases FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "shop_purchases_admin" ON shop_purchases FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
);

-- RPC: buy_shop_item — deduct coins from buyer, record purchase
CREATE OR REPLACE FUNCTION buy_shop_item(p_item_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_id uuid := auth.uid();
  v_item RECORD;
  v_buyer_coins integer;
  v_purchase_id uuid;
BEGIN
  IF v_buyer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id AND is_active = true;
  IF v_item IS NULL THEN RAISE EXCEPTION 'Item not found or unavailable'; END IF;
  IF v_item.user_id = v_buyer_id THEN RAISE EXCEPTION 'Cannot buy your own item'; END IF;

  SELECT coins INTO v_buyer_coins FROM profiles WHERE user_id = v_buyer_id FOR UPDATE;
  IF v_buyer_coins < v_item.price THEN
    RAISE EXCEPTION 'Insufficient coins. Have: %, Need: %', v_buyer_coins, v_item.price;
  END IF;

  -- Deduct coins
  UPDATE profiles SET coins = coins - v_item.price WHERE user_id = v_buyer_id;

  -- Record purchase
  INSERT INTO shop_purchases (buyer_id, item_id, seller_id, coins_paid, refund_deadline)
  VALUES (v_buyer_id, p_item_id, v_item.user_id, v_item.price, now() + interval '14 days')
  RETURNING id INTO v_purchase_id;

  -- Decrement stock if applicable
  IF v_item.stock IS NOT NULL THEN
    UPDATE shop_items SET stock = GREATEST(0, stock - 1) WHERE id = p_item_id;
    IF v_item.stock <= 1 THEN
      UPDATE shop_items SET is_active = false WHERE id = p_item_id AND stock <= 0;
    END IF;
  END IF;

  RETURN json_build_object('purchase_id', v_purchase_id, 'coins_paid', v_item.price);
END;
$$;

-- RPC: refund_shop_item — refund if unused and within deadline
CREATE OR REPLACE FUNCTION refund_shop_item(
  p_purchase_id uuid,
  p_reason text DEFAULT 'buyer_request'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_purchase RECORD;
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE user_id = v_user_id;

  SELECT * INTO v_purchase FROM shop_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_purchase IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;

  -- Only buyer or admin can refund
  IF v_purchase.buyer_id != v_user_id AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_purchase.status != 'completed' THEN
    RAISE EXCEPTION 'Purchase already refunded or disputed';
  END IF;

  IF v_purchase.is_used THEN
    RAISE EXCEPTION 'Item has been used and is not eligible for refund';
  END IF;

  -- Non-admin buyers must be within deadline
  IF NOT COALESCE(v_is_admin, false) THEN
    IF v_purchase.refund_deadline IS NOT NULL AND now() > v_purchase.refund_deadline THEN
      RAISE EXCEPTION 'Refund period has expired (14 days)';
    END IF;
  END IF;

  -- Process refund: restore coins to buyer
  UPDATE profiles SET coins = coins + v_purchase.coins_paid WHERE user_id = v_purchase.buyer_id;

  -- Mark purchase as refunded
  UPDATE shop_purchases
  SET status = 'refunded',
      refunded_at = now(),
      refund_reason = p_reason,
      refunded_by = v_user_id,
      refund_eligible = false
  WHERE id = p_purchase_id;

  RETURN json_build_object(
    'refunded', true,
    'coins_restored', v_purchase.coins_paid,
    'purchase_id', p_purchase_id
  );
END;
$$;

-- RPC: mark_shop_item_used — once used, no longer refundable
CREATE OR REPLACE FUNCTION mark_shop_item_used(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shop_purchases
  SET is_used = true, refund_eligible = false
  WHERE id = p_purchase_id AND buyer_id = auth.uid();
END;
$$;
