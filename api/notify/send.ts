import { createServiceClient } from '../_supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
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
    const { profileId, type, title, body } = await req.json();

    if (!profileId || !type || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: profileId, type, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['assignment', 'event', 'chat'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be: assignment, event, or chat' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createServiceClient();

    // Insert notification
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        profile_id: profileId,
        type,
        title,
        body,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting notification:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has email notifications enabled for this type
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('email_assignment, email_chat_digest')
      .eq('profile_id', profileId)
      .single();

    const shouldSendEmail = (type === 'assignment' && settings?.email_assignment) ||
                           (type === 'chat' && settings?.email_chat_digest);

    // If email is enabled and we have Resend configured, attempt to send email
    if (shouldSendEmail && Deno.env.get('RESEND_API_KEY')) {
      try {
        // Get user email
        const { data: { user } } = await supabase.auth.admin.getUserById(profileId);
        
        if (user?.email) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Segreto Amico <no-reply@lovableapp.com>',
              to: [user.email],
              subject: title,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #333;">${title}</h1>
                  <p style="color: #666; line-height: 1.6;">${body}</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="color: #999; font-size: 12px;">
                    Puoi modificare le tue preferenze di notifica nelle impostazioni del profilo.
                  </p>
                </div>
              `,
            }),
          });
          
          // Log email result but don't fail the request if email fails
          if (!response.ok) {
            console.warn('Email sending failed:', await response.text());
          }
        }
      } catch (emailError) {
        // Best-effort email sending - don't fail the notification creation
        console.warn('Email sending error:', emailError);
      }
    }

    return new Response(
      JSON.stringify({ notification }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}