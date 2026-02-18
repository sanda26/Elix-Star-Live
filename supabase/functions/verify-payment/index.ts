// Supabase Edge Function: verify-payment
// File: supabase/functions/verify-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing session ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    })

    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get metadata from session
    const { userId, packageId, coins, bonusCoins } = session.metadata || {}
    
    if (!userId || !packageId || !coins) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid session metadata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if this payment was already processed
    const { data: existingTransaction } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .single()

    if (existingTransaction) {
      // Return existing balance if already processed
      const { data: profile } = await supabase
        .from('profiles')
        .select('coins')
        .eq('user_id', userId)
        .single()

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment already processed',
          newBalance: profile?.coins || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Calculate total coins
    const totalCoins = parseInt(coins) + parseInt(bonusCoins || '0')

    // Update user's coin balance
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        coins: supabase.rpc('coins', { operator: '+', value: totalCoins })
      })
      .eq('user_id', userId)
      .select('coins')
      .single()

    if (updateError) {
      console.error('Error updating user coins:', updateError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to update coins' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Record transaction
    await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        package_id: packageId,
        stripe_session_id: sessionId,
        coins_purchased: parseInt(coins),
        bonus_coins: parseInt(bonusCoins || '0'),
        total_coins: totalCoins,
        amount: session.amount_total / 100, // Convert from cents
        currency: session.currency,
        status: 'completed',
        created_at: new Date().toISOString(),
      })

    // Send notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'purchase',
        title: 'Purchase Successful',
        body: `You received ${totalCoins} coins!`,
        data: {
          packageId,
          coins: totalCoins,
          sessionId,
        },
        is_read: false,
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and coins added',
        newBalance: updateData?.coins || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error verifying payment:', error)
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})