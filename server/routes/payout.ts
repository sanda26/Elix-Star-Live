import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getUserFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id || null;
}

// GET /api/creator/balance — get creator's earning balances
export async function handleGetCreatorBalance(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    // Mature any pending earnings first
    await supabase.rpc('mature_pending_earnings', { p_creator_id: userId });

    const { data: balance } = await supabase
      .from('creator_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!balance) {
      return res.json({
        pending_coins: 0,
        available_coins: 0,
        locked_coins: 0,
        total_earned: 0,
        total_withdrawn: 0,
      });
    }

    return res.json({
      pending_coins: balance.pending_coins,
      available_coins: balance.available_coins,
      locked_coins: balance.locked_coins,
      total_earned: balance.total_earned,
      total_withdrawn: balance.total_withdrawn,
    });
  } catch (err: any) {
    console.error('Get creator balance error:', err);
    return res.status(500).json({ error: 'Failed to get balance' });
  }
}

// GET /api/creator/earnings — get earnings history
export async function handleGetCreatorEarnings(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabase
      .from('creator_earnings_ledger')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({ earnings: data || [] });
  } catch (err: any) {
    console.error('Get creator earnings error:', err);
    return res.status(500).json({ error: 'Failed to get earnings' });
  }
}

// POST /api/creator/withdraw — request a payout
export async function handleCreatorWithdraw(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { coins_amount, payout_method_id } = req.body;
    if (!coins_amount || coins_amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const supabase = getServiceClient();

    // Use the user's JWT to call the RPC so auth.uid() works
    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7) || '';
    const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await userClient.rpc('request_payout', {
      p_coins_amount: coins_amount,
      p_payout_method_id: payout_method_id || null,
    });

    if (error) {
      console.error('Withdraw error:', error);
      return res.status(400).json({ error: error.message || 'Withdrawal failed' });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Creator withdraw error:', err);
    return res.status(500).json({ error: 'Withdrawal failed' });
  }
}

// GET /api/creator/payouts — get payout history
export async function handleGetCreatorPayouts(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ payouts: data || [] });
  } catch (err: any) {
    console.error('Get creator payouts error:', err);
    return res.status(500).json({ error: 'Failed to get payouts' });
  }
}

// POST /api/creator/payout-method — add/update payout method
export async function handleSetPayoutMethod(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, details } = req.body;
    if (!type || !details) {
      return res.status(400).json({ error: 'type and details required' });
    }

    const supabase = getServiceClient();

    // Set all existing methods as non-default
    await supabase.from('payout_methods').update({ is_default: false }).eq('user_id', userId);

    const { data, error } = await supabase
      .from('payout_methods')
      .insert({ user_id: userId, type, details, is_default: true })
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    console.error('Set payout method error:', err);
    return res.status(500).json({ error: 'Failed to set payout method' });
  }
}

// GET /api/creator/payout-methods — get payout methods
export async function handleGetPayoutMethods(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('payout_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return res.json({ methods: data || [] });
  } catch (err: any) {
    console.error('Get payout methods error:', err);
    return res.status(500).json({ error: 'Failed to get payout methods' });
  }
}

// ═══ ADMIN ENDPOINTS ═══

// GET /api/admin/payouts — list all pending payout requests
export async function handleAdminListPayouts(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).single();
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

    const status = (req.query.status as string) || 'pending';

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*, profiles!payout_requests_user_id_fkey(username, display_name, avatar_url)')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return res.json({ payouts: data || [] });
  } catch (err: any) {
    console.error('Admin list payouts error:', err);
    return res.status(500).json({ error: 'Failed to list payouts' });
  }
}

// POST /api/admin/payout/:id/approve
export async function handleAdminApprovePayout(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).single();
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

    const requestId = req.params.id;
    const { admin_note } = req.body;

    // Use service client with admin's auth context
    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7) || '';
    const adminClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await adminClient.rpc('admin_process_payout', {
      p_request_id: requestId,
      p_action: 'approve',
      p_admin_note: admin_note || null,
    });

    if (error) {
      console.error('Approve payout error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Admin approve payout error:', err);
    return res.status(500).json({ error: 'Failed to approve payout' });
  }
}

// POST /api/admin/payout/:id/reject
export async function handleAdminRejectPayout(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).single();
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

    const requestId = req.params.id;
    const { admin_note } = req.body;

    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7) || '';
    const adminClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await adminClient.rpc('admin_process_payout', {
      p_request_id: requestId,
      p_action: 'reject',
      p_admin_note: admin_note || null,
    });

    if (error) {
      console.error('Reject payout error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Admin reject payout error:', err);
    return res.status(500).json({ error: 'Failed to reject payout' });
  }
}

// POST /api/admin/chargeback — reverse a gift transaction's pending earnings
export async function handleAdminChargeback(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).single();
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

    const { gift_tx_id } = req.body;
    if (!gift_tx_id) return res.status(400).json({ error: 'gift_tx_id required' });

    const { data, error } = await supabase.rpc('reverse_pending_earning', { p_gift_tx_id: gift_tx_id });

    if (error) {
      console.error('Chargeback error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Admin chargeback error:', err);
    return res.status(500).json({ error: 'Chargeback failed' });
  }
}

// ═══ SHOP ITEM PURCHASE & REFUND ═══

// POST /api/shop/buy — buy a shop item with coins
export async function handleShopBuy(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });

    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7) || '';
    const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await userClient.rpc('buy_shop_item', { p_item_id: item_id });
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    console.error('Shop buy error:', err);
    return res.status(500).json({ error: 'Purchase failed' });
  }
}

// POST /api/shop/refund — refund a shop item (if unused, within 14 days)
export async function handleShopRefund(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { purchase_id, reason } = req.body;
    if (!purchase_id) return res.status(400).json({ error: 'purchase_id required' });

    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7) || '';
    const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await userClient.rpc('refund_shop_item', {
      p_purchase_id: purchase_id,
      p_reason: reason || 'buyer_request',
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    console.error('Shop refund error:', err);
    return res.status(500).json({ error: 'Refund failed' });
  }
}

// GET /api/shop/purchases — get user's shop purchase history
export async function handleShopPurchases(req: Request, res: Response) {
  try {
    const userId = await getUserFromAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('shop_purchases')
      .select('*, item:shop_items(title, image_url)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ purchases: data || [] });
  } catch (err: any) {
    console.error('Shop purchases error:', err);
    return res.status(500).json({ error: 'Failed to get purchases' });
  }
}
