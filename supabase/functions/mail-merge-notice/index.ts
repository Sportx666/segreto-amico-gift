import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { adminEmail, eventId, profileId, mergedPids } = await req.json();
    
    if (!adminEmail || !eventId || !profileId || !mergedPids) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for available email service
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

    if (!resendApiKey && !sendgridApiKey) {
      console.log('No email service configured, logging merge notice:', {
        adminEmail,
        eventId,
        profileId,
        mergedPids
      });
      return new Response(JSON.stringify({ message: 'No email service configured' }), {
        status: 204,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get event details
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', profileId)
      .single();

    const eventName = event?.name || 'Event';
    const userEmail = profile?.email || 'user';
    const displayName = profile?.display_name || userEmail;

    const subject = `Duplicate memberships merged for ${eventName}`;
    const htmlContent = `
      <h2>Duplicate Memberships Merged</h2>
      <p>Hello,</p>
      <p>A user has claimed multiple invites for your event "<strong>${eventName}</strong>" and their duplicate memberships have been automatically merged.</p>
      
      <h3>Details:</h3>
      <ul>
        <li><strong>User:</strong> ${displayName} (${userEmail})</li>
        <li><strong>Event:</strong> ${eventName}</li>
        <li><strong>Merged Participants:</strong> ${mergedPids.length}</li>
      </ul>
      
      <p>All event-related data (wishlists, assignments, exclusions) has been consolidated under a single membership. No action is required on your part.</p>
      
      <p>Best regards,<br>Amico Segreto Team</p>
    `;

    // Try Resend first, then SendGrid
    if (resendApiKey) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Amico Segreto <noreply@resend.dev>',
            to: [adminEmail],
            subject,
            html: htmlContent,
          }),
        });

        if (resendResponse.ok) {
          console.log('Merge notification sent successfully via Resend');
          return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          const error = await resendResponse.json();
          console.error('Resend API error:', error);
        }
      } catch (error) {
        console.error('Resend service error:', error);
      }
    }

    if (sendgridApiKey) {
      try {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: adminEmail }],
              subject,
            }],
            from: { email: 'noreply@amicosegreto.com', name: 'Amico Segreto' },
            content: [{
              type: 'text/html',
              value: htmlContent,
            }],
          }),
        });

        if (sendgridResponse.ok) {
          console.log('Merge notification sent successfully via SendGrid');
          return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          const error = await sendgridResponse.json();
          console.error('SendGrid API error:', error);
        }
      } catch (error) {
        console.error('SendGrid service error:', error);
      }
    }

    // If all email services fail, log and return success
    console.log('All email services failed, logging merge notice:', {
      adminEmail,
      eventId,
      profileId,
      mergedPids
    });

    return new Response(JSON.stringify({ message: 'Email services unavailable, notification logged' }), {
      status: 204,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in mail-merge-notice function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});