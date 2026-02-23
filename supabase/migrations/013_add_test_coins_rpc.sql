-- RPC to add test coins to the calling user's profile (bypasses RLS)
CREATE OR REPLACE FUNCTION add_test_coins(p_amount integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  IF p_amount <= 0 OR p_amount > 999999 THEN
    RETURN json_build_object('error', 'Invalid amount');
  END IF;

  UPDATE profiles
  SET coins = COALESCE(coins, 0) + p_amount
  WHERE user_id = v_user_id
  RETURNING coins INTO v_new_balance;

  RETURN json_build_object('new_balance', v_new_balance);
END;
$$;
