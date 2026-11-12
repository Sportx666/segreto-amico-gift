import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/**
 * Re-point an invited placeholder participant's data in one event to the
 * user's existing participant (participants.profile_id is unique, so a
 * returning user can't simply adopt the placeholder).
 */
async function adoptPlaceholder(
  supabase: SupabaseClient,
  eventId: string,
  placeholderId: string,
  userParticipantId: string,
) {
  const { data: existing } = await supabase
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('participant_id', userParticipantId)
    .maybeSingle()

  if (existing) {
    // Already a member: drop the placeholder's membership
    await supabase.from('event_members').delete().eq('event_id', eventId).eq('participant_id', placeholderId)
  } else {
    // Take over the invited slot (keeps the name/email the admin entered)
    const { error } = await supabase
      .from('event_members')
      .update({ participant_id: userParticipantId })
      .eq('event_id', eventId)
      .eq('participant_id', placeholderId)
    if (error) throw error
  }

  // Exclusions the admin configured for the invitee now apply to the user
  await supabase.from('exclusions').update({ giver_id: userParticipantId }).eq('event_id', eventId).eq('giver_id', placeholderId)
  await supabase.from('exclusions').update({ blocked_id: userParticipantId }).eq('event_id', eventId).eq('blocked_id', placeholderId)
  await supabase.from('join_tokens').update({ participant_id: userParticipantId }).eq('event_id', eventId).eq('participant_id', placeholderId)

  // Remove the placeholder if nothing else references it
  const { count } = await supabase
    .from('event_members')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', placeholderId)
  if (!count) {
    await supabase.from('join_tokens').delete().eq('participant_id', placeholderId)
    await supabase.from('participants').delete().eq('id', placeholderId).is('profile_id', null)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let claimedToken: string | null = null

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)
    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userErr || !user) return json({ error: 'unauthorized' }, 401)

    const { token } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string' || token.length > 128) return json({ error: 'token_required' }, 400)

    // Claim the token atomically so it can only be used once
    const { data: claimed } = await supabase
      .from('join_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('event_id, participant_id')
      .maybeSingle()

    if (!claimed) {
      const { data: jt } = await supabase.from('join_tokens').select('used_at, expires_at').eq('token', token).maybeSingle()
      if (!jt) return json({ error: 'invalid' }, 400)
      if (jt.used_at) return json({ error: 'used' }, 400)
      return json({ error: 'expired' }, 400)
    }
    claimedToken = token
    const eventId = claimed.event_id as string

    // The user's own participant row, if any (one per account)
    const { data: own } = await supabase.from('participants').select('id').eq('profile_id', user.id).maybeSingle()
    let participantId: string | null = own?.id ?? null

    if (claimed.participant_id) {
      const { data: invited } = await supabase
        .from('participants')
        .select('id, profile_id')
        .eq('id', claimed.participant_id)
        .maybeSingle()
      if (!invited) throw new Error('invited participant missing')

      if (invited.profile_id && invited.profile_id !== user.id) {
        // Personal invite meant for someone else: give the token back
        await supabase.from('join_tokens').update({ used_at: null }).eq('token', token)
        claimedToken = null
        return json({ error: 'forbidden' }, 403)
      }

      if (!invited.profile_id) {
        if (participantId) {
          await adoptPlaceholder(supabase, eventId, invited.id, participantId)
        } else {
          const { error } = await supabase
            .from('participants')
            .update({ profile_id: user.id })
            .eq('id', invited.id)
            .is('profile_id', null)
          if (error) throw error
          participantId = invited.id
        }
      } else {
        participantId = invited.id
      }
    }

    if (!participantId) {
      const { data: created, error } = await supabase
        .from('participants')
        .insert({ profile_id: user.id })
        .select('id')
        .single()
      if (error || !created) throw error ?? new Error('participant_create_failed')
      participantId = created.id
    }

    // Join (keep an existing role, e.g. the admin claiming their own link)
    const { data: member } = await supabase
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('participant_id', participantId)
      .maybeSingle()

    if (member) {
      const { error } = await supabase.from('event_members').update({ status: 'joined' }).eq('id', member.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('event_members')
        .insert({ event_id: eventId, participant_id: participantId, role: 'member', status: 'joined' })
      if (error) throw error
    }

    const { data: wl } = await supabase
      .from('wishlists')
      .select('id')
      .eq('event_id', eventId)
      .eq('owner_id', participantId)
      .maybeSingle()
    if (!wl) {
      await supabase.from('wishlists').insert({ event_id: eventId, owner_id: participantId, title: 'La mia lista' })
    }

    return json({ redirect: `/events/${eventId}` })
  } catch (error) {
    console.error('Error in join-claim function:', error)
    if (claimedToken) {
      // Let the user retry with the same link
      await supabase.from('join_tokens').update({ used_at: null }).eq('token', claimedToken)
    }
    return json({ error: 'Internal server error' }, 500)
  }
})
