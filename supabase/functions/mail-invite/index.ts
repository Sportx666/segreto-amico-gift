import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, eventId, participantId, joinUrl } = await req.json()
    if (!email || !eventId || !participantId || !joinUrl) {
      return new Response(JSON.stringify({ error: 'email, eventId, participantId, and joinUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify user is admin of the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('admin_profile_id, name')
      .eq('id', eventId)
      .single()
    
    if (eventError || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (event.admin_profile_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Only send our own invite links, only to the address stored for that member.
    // Otherwise any user could create an event and relay phishing mail through us.
    const baseUrl = (Deno.env.get('PUBLIC_BASE_URL') || 'https://amicosegreto.fun').replace(/\/$/, '')
    let parsedUrl: URL | null = null
    try { parsedUrl = new URL(String(joinUrl)) } catch { parsedUrl = null }
    const allowedOrigins = new Set([new URL(baseUrl).origin, 'https://amicosegreto.fun', 'https://www.amicosegreto.fun'])
    if (!parsedUrl || !allowedOrigins.has(parsedUrl.origin) || !/^\/join\/[A-Za-z0-9]{10,64}$/.test(parsedUrl.pathname)) {
      return new Response(JSON.stringify({ error: 'Invalid join URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const { data: member } = await supabase
      .from('event_members')
      .select('anonymous_email')
      .eq('event_id', eventId)
      .eq('participant_id', participantId)
      .maybeSingle()
    if (!member || (member.anonymous_email ?? '').toLowerCase() !== normalizedEmail) {
      return new Response(JSON.stringify({ error: 'Email does not match this member' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const safeEventName = escapeHtml(event.name ?? '')
    const safeJoinUrl = escapeHtml(parsedUrl.toString())

    // Check if email service is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')

    if (!resendApiKey && !sendgridApiKey) {
      console.log('No email service configured - skipping invite email')
      return new Response('', {
        status: 204,
        headers: corsHeaders
      })
    }

    if (resendApiKey) {
      // Send via Resend
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Amico Segreto <noreply@amicosegreto.lovable.app>',
          to: [normalizedEmail],
          subject: 'Invito Amico Segreto',
          html: `
            <h1>Sei stato invitato a partecipare!</h1>
            <p>Ciao! Sei stato invitato a partecipare all'evento "<strong>${safeEventName}</strong>".</p>
            <p>Clicca sul link qui sotto per unirti:</p>
            <p><a href="${safeJoinUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Unisciti all'evento</a></p>
            <p>Oppure copia e incolla questo link nel tuo browser:</p>
            <p>${safeJoinUrl}</p>
            <p>Non vediamo l'ora di vederti partecipare!</p>
          `,
        }),
      })

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text()
        console.error('Resend API error:', errorText)
        throw new Error('Failed to send email via Resend')
      }

      const resendData = await resendResponse.json()
      console.log('Email sent via Resend:', resendData)
      
    } else if (sendgridApiKey) {
      // Send via SendGrid
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: normalizedEmail }],
            subject: 'Invito Amico Segreto',
          }],
          from: { email: 'noreply@amicosegreto.lovable.app', name: 'Amico Segreto' },
          content: [{
            type: 'text/html',
            value: `
              <h1>Sei stato invitato a partecipare!</h1>
              <p>Ciao! Sei stato invitato a partecipare all'evento "<strong>${safeEventName}</strong>".</p>
              <p>Clicca sul link qui sotto per unirti:</p>
              <p><a href="${safeJoinUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Unisciti all'evento</a></p>
              <p>Oppure copia e incolla questo link nel tuo browser:</p>
              <p>${safeJoinUrl}</p>
              <p>Non vediamo l'ora di vederti partecipare!</p>
            `,
          }],
        }),
      })

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text()
        console.error('SendGrid API error:', errorText)
        throw new Error('Failed to send email via SendGrid')
      }

      console.log('Email sent via SendGrid')
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in mail-invite function:', error)
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})