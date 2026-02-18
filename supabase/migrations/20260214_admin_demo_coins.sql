-- Admin Demo Coins System - Secure Implementation
-- Run these in Supabase Dashboard -> SQL Editor

-- 1) Admin coin transactions table for audit trail
CREATE TABLE IF NOT EXISTS admin_coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL DEFAULT 'demo_coins',
  reason text DEFAULT 'Demo coins recharge',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance and audit
CREATE INDEX IF NOT EXISTS idx_admin_coin_transactions_admin_id ON admin_coin_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_coin_transactions_target_user_id ON admin_coin_transactions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_coin_transactions_created_at ON admin_coin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_coin_transactions_type ON admin_coin_transactions(transaction_type);

-- Enable Row Level Security
ALTER TABLE admin_coin_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can view their own transactions
CREATE POLICY "Admins can view own admin transactions" ON admin_coin_transactions FOR SELECT USING (
  auth.uid() = admin_id
);

CREATE POLICY "Admins can insert own admin transactions" ON admin_coin_transactions FOR INSERT WITH CHECK (
  auth.uid() = admin_id
);

-- 2) Rate limiting table for admin operations
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type text NOT NULL DEFAULT 'demo_coins',
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for rate limiting
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_admin_operation ON admin_rate_limits(admin_id, operation_type, window_start);

-- Enable Row Level Security
ALTER TABLE admin_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate limiting
CREATE POLICY "Admins can manage own rate limits" ON admin_rate_limits FOR ALL USING (
  auth.uid() = admin_id
);

-- 3) SECURE RPC FUNCTION: admin_add_demo_coins
CREATE OR REPLACE FUNCTION admin_add_demo_coins(
  p_target_user_id uuid,
  p_amount integer,
  p_pin text,
  p_reason text DEFAULT 'Demo coins recharge'
)
RETURNS TABLE (
  success boolean,
  message text,
  new_balance integer,
  transaction_id uuid
) AS $$
DECLARE
  admin_id uuid;
  correct_pin text;
  current_balance integer;
  rate_limit_count integer;
  window_start timestamptz;
  transaction_id uuid;
BEGIN
  -- Get current admin user
  admin_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_id IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required', 0, NULL::uuid;
    RETURN;
  END IF;

  -- VERIFY ADMIN WHITELIST (customize with your user ID or email)
  -- Option 1: Whitelist by specific user IDs
  IF admin_id NOT IN (
    'YOUR_USER_ID_HERE', -- Replace with your actual user ID
    'OTHER_ADMIN_ID_HERE' -- Add other admin IDs if needed
  ) THEN
    -- Option 2: Whitelist by email domain (uncomment if preferred)
    -- IF NOT EXISTS (
    --   SELECT 1 FROM auth.users 
    --   WHERE id = admin_id AND email LIKE '%@elixstar.com'
    -- ) THEN
      RETURN QUERY SELECT false, 'Access denied: Admin privileges required', 0, NULL::uuid;
      RETURN;
    -- END IF;
  END IF;

  -- VERIFY PIN from environment (server-side only)
  correct_pin := current_setting('app.settings.admin_demo_pin', true);
  
  IF correct_pin IS NULL OR correct_pin = '' THEN
    RETURN QUERY SELECT false, 'Admin PIN not configured', 0, NULL::uuid;
    RETURN;
  END IF;

  IF p_pin != correct_pin THEN
    RETURN QUERY SELECT false, 'Invalid PIN', 0, NULL::uuid;
    RETURN;
  END IF;

  -- RATE LIMITING: Max 5 operations per minute per admin
  window_start := date_trunc('minute', now());
  
  SELECT COUNT(*) INTO rate_limit_count
  FROM admin_rate_limits
  WHERE admin_id = admin_id
  AND operation_type = 'demo_coins'
  AND window_start = window_start;
  
  IF rate_limit_count >= 5 THEN
    RETURN QUERY SELECT false, 'Rate limit exceeded: Max 5 operations per minute', 0, NULL::uuid;
    RETURN;
  END IF;

  -- Update rate limit counter
  INSERT INTO admin_rate_limits (admin_id, operation_type, window_start)
  VALUES (admin_id, 'demo_coins', window_start)
  ON CONFLICT (admin_id, operation_type, window_start)
  DO UPDATE SET request_count = admin_rate_limits.request_count + 1;

  -- VALIDATE AMOUNT
  IF p_amount <= 0 OR p_amount > 1000000 THEN
    RETURN QUERY SELECT false, 'Invalid amount: Must be between 1 and 1,000,000', 0, NULL::uuid;
    RETURN;
  END IF;

  -- GET CURRENT BALANCE
  SELECT coins INTO current_balance
  FROM profiles
  WHERE user_id = p_target_user_id;
  
  IF current_balance IS NULL THEN
    RETURN QUERY SELECT false, 'Target user not found', 0, NULL::uuid;
    RETURN;
  END IF;

  -- PERFORM TRANSACTION
  UPDATE profiles
  SET coins = coins + p_amount
  WHERE user_id = p_target_user_id
  RETURNING coins INTO new_balance;

  -- LOG TRANSACTION FOR AUDIT
  INSERT INTO admin_coin_transactions (
    admin_id,
    target_user_id,
    amount,
    transaction_type,
    reason,
    ip_address,
    user_agent
  ) VALUES (
    admin_id,
    p_target_user_id,
    p_amount,
    'demo_coins',
    p_reason,
    inet_client_addr(),
    current_setting('request.headers')::json->>'user-agent'
  )
  RETURNING id INTO transaction_id;

  -- RETURN SUCCESS
  RETURN QUERY SELECT 
    true, 
    'Demo coins added successfully', 
    new_balance, 
    transaction_id;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      'Error: ' || SQLERRM, 
      COALESCE(current_balance, 0), 
      NULL::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Grant permissions
GRANT EXECUTE ON FUNCTION admin_add_demo_coins TO authenticated;

-- 5) Clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission for cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO authenticated;

-- =====================================================
-- SETUP INSTRUCTIONS:
-- 1. Set the admin PIN in Supabase Dashboard -> Settings -> Environment Variables:
--    app.settings.admin_demo_pin = "your_secure_pin_here"
--
-- 2. Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users table
--
-- 3. The function is now ready for use from frontend
-- =====================================================