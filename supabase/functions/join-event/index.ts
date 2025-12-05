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

    // Get user from auth header
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
      console.error('Auth error:', userErr)
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: 'code_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Join event request: code=${code}, user=${user.id}`)

    // Find event by join_code
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, name, draw_status, join_code')
      .eq('join_code', code.toUpperCase())
      .single()

    if (eventErr || !event) {
      console.log('Event not found for code:', code)
      return new Response(JSON.stringify({ error: 'invalid_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if event is still accepting new members (pending status)
    if (event.draw_status !== 'pending') {
      console.log('Event draw already completed:', event.id)
      return new Response(JSON.stringify({ error: 'event_closed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is already a member of this event
    const { data: existingMember } = await supabase
      .from('event_members')
      .select('id, participant_id, status')
      .eq('event_id', event.id)
      .eq('participant_id', (
        await supabase
          .from('participants')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
      ).data?.id)
      .maybeSingle()

    // Get or create participant for this user
    let participantId: string

    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (existingParticipant?.id) {
      participantId = existingParticipant.id
    } else {
      const { data: newParticipant, error: createErr } = await supabase
        .from('participants')
        .insert({ profile_id: user.id })
        .select('id')
        .single()

      if (createErr || !newParticipant) {
        console.error('Failed to create participant:', createErr)
        return new Response(JSON.stringify({ error: 'participant_create_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      participantId = newParticipant.id
    }

    // Check again for existing membership with the correct participant_id
    const { data: memberCheck } = await supabase
      .from('event_members')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('participant_id', participantId)
      .maybeSingle()

    if (memberCheck) {
      if (memberCheck.status === 'joined') {
        console.log('User already joined:', user.id, event.id)
        return new Response(JSON.stringify({ 
          redirect: `/events/${event.id}`,
          message: 'already_member'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Update existing membership to joined
      await supabase
        .from('event_members')
        .update({ status: 'joined' })
        .eq('id', memberCheck.id)
    } else {
      // Create new event membership
      const { error: memberErr } = await supabase
        .from('event_members')
        .insert({
          event_id: event.id,
          participant_id: participantId,
          role: 'member',
          status: 'joined',
        })

      if (memberErr) {
        console.error('Failed to create event membership:', memberErr)
        return new Response(JSON.stringify({ error: 'member_create_failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Fix any duplicate memberships
    const { error: fixErr } = await supabase.rpc(
      'fix_event_membership_duplicates',
      { _event_id: event.id, _profile_id: user.id }
    )

    if (fixErr) {
      console.warn('Failed to fix duplicates:', fixErr)
    }

    // Ensure default wishlist exists
    const { data: existingWishlist } = await supabase
      .from('wishlists')
      .select('id')
      .eq('event_id', event.id)
      .eq('owner_id', participantId)
      .maybeSingle()

    if (!existingWishlist) {
      await supabase
        .from('wishlists')
        .insert({ 
          event_id: event.id, 
          owner_id: participantId, 
          title: 'La mia lista' 
        })
    }

    console.log(`User ${user.id} successfully joined event ${event.id}`)

    return new Response(JSON.stringify({ 
      redirect: `/events/${event.id}`,
      eventName: event.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in join-event function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
