import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { token } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ error: 'token_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load token row
    const { data: jt, error: jtErr } = await supabase
      .from('join_tokens')
      .select('event_id, participant_id, expires_at, used_at')
      .eq('token', token)
      .single()

    if (jtErr || !jt) {
      return new Response(JSON.stringify({ error: 'invalid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (jt.used_at) {
      return new Response(JSON.stringify({ error: 'used' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (new Date(jt.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let participantId = jt.participant_id as string | null

    if (participantId) {
      // Load participant
      const { data: participant, error: partErr } = await supabase
        .from('participants')
        .select('id, profile_id')
        .eq('id', participantId)
        .single()

      if (partErr || !participant) {
        return new Response(JSON.stringify({ error: 'invalid' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (participant.profile_id && participant.profile_id !== user.id) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!participant.profile_id) {
        await supabase
          .from('participants')
          .update({ profile_id: user.id })
          .eq('id', participantId)
          .is('profile_id', null)
      }
    } else {
      // Generic invite - create or reuse participant bound to user
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (existing?.id) {
        participantId = existing.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('participants')
          .insert({ profile_id: user.id })
          .select('id')
          .single()

        if (insErr || !inserted) {
          return new Response(JSON.stringify({ error: insErr?.message || 'participant_create_failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        participantId = inserted.id
      }
    }

    // Upsert event membership
    const { data: memberRow, error: memberErr } = await supabase
      .from('event_members')
      .upsert({
        event_id: jt.event_id,
        participant_id: participantId,
        role: 'member',
        status: 'joined',
      }, { onConflict: 'event_id,participant_id' })
      .select('id')
      .single()

    if (memberErr || !memberRow) {
      return new Response(JSON.stringify({ error: memberErr?.message || 'member_upsert_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fix any duplicate memberships and check for merging
    const { data: fixResult, error: fixErr } = await supabase.rpc(
      'fix_event_membership_duplicates',
      { _event_id: jt.event_id, _profile_id: user.id }
    )

    if (fixErr) {
      console.warn('Failed to fix duplicates:', fixErr)
    }

    // If duplicates were merged, notify admin
    if (fixResult?.merged_pids?.length > 0) {
      try {
        // Get admin email
        const { data: event } = await supabase
          .from('events')
          .select('admin_profile_id')
          .eq('id', jt.event_id)
          .single()
        
        if (event?.admin_profile_id) {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', event.admin_profile_id)
            .single()
          
          if (adminProfile?.email) {
            // Send merge notification
            await supabase.functions.invoke('mail-merge-notice', {
              body: {
                adminEmail: adminProfile.email,
                eventId: jt.event_id,
                profileId: user.id,
                mergedPids: fixResult.merged_pids
              }
            })
          }
        }
      } catch (mailErr) {
        console.warn('Failed to send merge notification:', mailErr)
      }
    }

    // Ensure default wishlist exists
    const { data: wl } = await supabase
      .from('wishlists')
      .select('id')
      .eq('event_id', jt.event_id)
      .eq('owner_id', participantId)
      .maybeSingle()

    if (!wl) {
      await supabase
        .from('wishlists')
        .insert({ event_id: jt.event_id, owner_id: participantId, title: 'La mia lista' })
    }

    // Mark token as used
    await supabase
      .from('join_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    return new Response(JSON.stringify({ redirect: `/events/${jt.event_id}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in join-claim function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})