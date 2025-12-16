import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FCM configuration - loaded once at module scope
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

interface PushPayload {
  profileIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface FCMMessage {
  to: string;
  notification: {
    title: string;
    body: string;
    sound: string;
  };
  data?: Record<string, string>;
  priority: string;
}

// Send push notification via FCM
async function sendFCM(token: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  if (!FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured, skipping push notification');
    return false;
  }

  const message: FCMMessage = {
    to: token,
    notification: {
      title,
      body,
      sound: 'default',
    },
    data,
    priority: 'high',
  };

  try {
    const response = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.success === 1) {
      console.log('FCM push sent successfully to token:', token.substring(0, 20) + '...');
      return true;
    } else if (result.failure === 1) {
      console.warn('FCM push failed:', result.results?.[0]?.error);
      // Return the error type for token cleanup
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('FCM send error:', error);
    return false;
  }
}

interface PushTokenRecord {
  id: string;
  profile_id: string;
  token: string;
  platform: string;
}

// Internal function to send push notifications
export async function sendPushNotifications(
  supabase: any,
  payload: PushPayload
): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
  const { profileIds, title, body, data } = payload;
  
  if (!profileIds || profileIds.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  // Get push tokens for all profile IDs
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id, profile_id, token, platform')
    .in('profile_id', profileIds) as { data: PushTokenRecord[] | null; error: any };

  if (error) {
    console.error('Error fetching push tokens:', error);
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  if (!tokens || tokens.length === 0) {
    console.log('No push tokens found for profiles:', profileIds);
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  console.log(`Found ${tokens.length} push tokens for ${profileIds.length} profiles`);

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  // Send to each token
  for (const tokenRecord of tokens) {
    // Currently only FCM is supported (Android and iOS via Firebase)
    const success = await sendFCM(tokenRecord.token, title, body, data);
    
    if (success) {
      sent++;
    } else {
      failed++;
      // Mark token for cleanup if invalid
      invalidTokens.push(tokenRecord.id);
    }
  }

  // Clean up invalid tokens
  if (invalidTokens.length > 0) {
    console.log(`Cleaning up ${invalidTokens.length} invalid tokens`);
    await supabase
      .from('push_tokens')
      .delete()
      .in('id', invalidTokens);
  }

  return { sent, failed, invalidTokens };
}

// HTTP handler for direct calls (optional)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify service role key for internal calls
    const authHeader = req.headers.get('authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader?.includes(serviceRoleKey || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: PushPayload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result = await sendPushNotifications(supabase as any, payload);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-push:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
