// Supabase Edge Function: send-push-notification
// File: supabase/functions/send-push-notification/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: any;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const notification: PushNotification = await req.json()

    if (!notification.userId || !notification.title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get device tokens for the user
    const { data: deviceTokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', notification.userId)

    if (tokenError) {
      console.error('Error fetching device tokens:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No device tokens found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send push notification to each device token
    const results = await Promise.allSettled(
      deviceTokens.map(async (device) => {
        try {
          const subscription = JSON.parse(device.token)
          return await sendPushNotification(subscription, notification)
        } catch (error) {
          console.error('Failed to send to device:', error)
          return { success: false, error: error.message }
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    // Store notification in database
    await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId,
        type: 'push',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: successful > 0,
        message: `Sent to ${successful} device(s), ${failed} failed`,
        total: results.length,
        successful,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function sendPushNotification(subscription: any, notification: PushNotification): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-192x192.png',
      tag: notification.tag,
      requireInteraction: notification.requireInteraction || false,
      data: notification.data || {},
      actions: notification.actions || []
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: subscription.endpoint,
        notification: payload,
        webpush: {
          headers: {
            TTL: '2419200', // 28 days in seconds
          }
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData?.message || 'FCM request failed' }
    }

    const data = await response.json()
    
    if (data.failure === 1) {
      return { success: false, error: 'FCM reported failure' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}