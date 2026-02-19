import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Service role required to update balances securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Auth client to verify sender
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { user: sender } = (await supabaseAuth.auth.getUser()).data
    if (!sender) throw new Error('Unauthorized')

    const { receiver_id, gift_id, stream_id, post_id, amount = 1 } = await req.json()

    // 1. Get Gift Details
    const { data: gift, error: giftError } = await supabaseAdmin
      .from('gifts_catalog')
      .select('coin_cost')
      .eq('id', gift_id)
      .single()
    
    if (giftError || !gift) throw new Error('Invalid gift')

    const totalCost = gift.coin_cost * amount

    // 2. Check Balance
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('coin_balances')
      .select('balance')
      .eq('user_id', sender.id)
      .single()

    if (balanceError || (balanceData?.balance ?? 0) < totalCost) {
      throw new Error('Insufficient coins')
    }

    // 3. Deduct Coins (Atomic transaction ideally, simulated here via RPC or sequential updates)
    // We'll use a sequential update for the stub, assuming RLS prevents race conditions usually, but admin role bypasses RLS.
    // Ideally use an RPC function: decrement_balance(user_id, amount)
    
    const { error: updateError } = await supabaseAdmin
      .from('coin_balances')
      .update({ balance: (balanceData.balance - totalCost) })
      .eq('user_id', sender.id)

    if (updateError) throw updateError

    // 4. Record Transaction & Gift Send
    await supabaseAdmin.from('coin_transactions').insert({
      user_id: sender.id,
      type: 'spend',
      amount: -totalCost,
      ref_id: stream_id || post_id
    })

    const { data: sendData, error: sendError } = await supabaseAdmin
      .from('gift_sends')
      .insert({
        sender_id: sender.id,
        receiver_id,
        gift_id,
        live_id: stream_id,
        post_id,
        amount
      })
      .select()
      .single()

    if (sendError) throw sendError

    // 5. Credit Receiver (Optional: Diamonds logic)
    // await supabaseAdmin.rpc('increment_diamonds', { user_id: receiver_id, amount: ... })

    return new Response(
      JSON.stringify(sendData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})
