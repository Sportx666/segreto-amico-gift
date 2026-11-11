import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { planJoin } from "./plan.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function mergeSlotIntoParticipant(
  supabase: SupabaseClient,
  eventId: string,
  canonicalId: string,
  mergeFrom: string,
) {
  if (canonicalId === mergeFrom) return

  const { data: canonMember, error: canonErr } = await supabase
    .from('event_members')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('participant_id', canonicalId)
    .maybeSingle()
  if (canonErr) throw canonErr

  const { data: slotMember, error: slotErr } = await supabase
    .from('event_members')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('participant_id', mergeFrom)
    .maybeSingle()
  if (slotErr) throw slotErr

  if (slotMember && !canonMember) {
    const { error } = await supabase
      .from('event_members')
      .update({ participant_id: canonicalId, status: 'joined' })
      .eq('id', slotMember.id)
    if (error) throw error
  } else if (slotMember && canonMember) {
    if (canonMember.status !== 'joined') {
      const { error } = await supabase
        .from('event_members')
        .update({ status: 'joined' })
        .eq('id', canonMember.id)
      if (error) throw error
    }
    const { error } = await supabase.from('event_members').delete().eq('id', slotMember.id)
    if (error) throw error
  }

  const { data: lists, error: listErr } = await supabase
    .from('wishlists')
    .select('id, owner_id')
    .eq('event_id', eventId)
    .in('owner_id', [canonicalId, mergeFrom])
  if (listErr) throw listErr

  const canonList = (lists || []).find((list) => list.owner_id === canonicalId)
  const slotList = (lists || []).find((list) => list.owner_id === mergeFrom)

  if (slotList && !canonList) {
    const { error } = await supabase.from('wishlists').update({ owner_id: canonicalId }).eq('id', slotList.id)
    if (error) throw error
    const { error: itemErr } = await supabase
      .from('wishlist_items')
      .update({ owner_id: canonicalId })
      .eq('wishlist_id', slotList.id)
    if (itemErr) throw itemErr
  } else if (slotList && canonList) {
    const { data: items, error: itemsErr } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', slotList.id)
    if (itemsErr) throw itemsErr
    for (const item of items || []) {
      const { error } = await supabase
        .from('wishlist_items')
        .update({ wishlist_id: canonList.id, owner_id: canonicalId })
        .eq('id', item.id)
      if (error) {
        await supabase.from('wishlist_items').delete().eq('id', item.id)
      }
    }
    const { error } = await supabase.from('wishlists').delete().eq('id', slotList.id)
    if (error) throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)

    const accessToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !user) return json({ error: 'unauthorized' }, 401)

    const { token } = await req.json()
    if (!token) return json({ error: 'token_required' }, 400)

    const { data: jt, error: jtErr } = await supabase
      .from('join_tokens')
      .select('event_id, participant_id, expires_at, used_at')
      .eq('token', token)
      .single()

    if (jtErr || !jt) return json({ error: 'invalid' }, 400)
    if (jt.used_at) return json({ error: 'used' }, 400)
    if (new Date(jt.expires_at) < new Date()) return json({ error: 'expired' }, 400)

    let tokenParticipant: { id: string; profile_id: string | null } | null = null
    if (jt.participant_id) {
      const { data: participant, error: partErr } = await supabase
        .from('participants')
        .select('id, profile_id')
        .eq('id', jt.participant_id)
        .single()
      if (partErr || !participant) return json({ error: 'invalid' }, 400)
      tokenParticipant = participant
    }

    const { data: existingParticipant, error: existingErr } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (existingErr) return json({ error: 'participant_lookup_failed' }, 500)

    const plan = planJoin({
      userId: user.id,
      tokenParticipant,
      existingParticipantId: existingParticipant?.id ?? null,
    })

    if (plan.type === 'forbidden') return json({ error: 'forbidden' }, 403)

    let participantId: string
    if (plan.type === 'create') {
      const { data: created, error: createErr } = await supabase
        .from('participants')
        .insert({ profile_id: user.id })
        .select('id')
        .single()
      if (createErr || !created) return json({ error: 'participant_create_failed' }, 500)
      participantId = created.id
    } else if (plan.type === 'claim') {
      const { data: claimed, error: claimErr } = await supabase
        .from('participants')
        .update({ profile_id: user.id })
        .eq('id', plan.participantId)
        .is('profile_id', null)
        .select('id')
        .maybeSingle()
      if (claimErr || !claimed) return json({ error: 'participant_claim_failed' }, 409)
      participantId = claimed.id
    } else {
      participantId = plan.participantId
      if (plan.mergeFrom) {
        try {
          await mergeSlotIntoParticipant(supabase, jt.event_id, participantId, plan.mergeFrom)
        } catch (mergeErr) {
          console.error('Failed to merge invite slot:', mergeErr)
          return json({ error: 'member_merge_failed' }, 500)
        }
      }
    }

    const { data: memberCheck, error: memberReadErr } = await supabase
      .from('event_members')
      .select('id, status')
      .eq('event_id', jt.event_id)
      .eq('participant_id', participantId)
      .maybeSingle()
    if (memberReadErr) return json({ error: 'member_lookup_failed' }, 500)

    let alreadyMember = false
    if (memberCheck?.status === 'joined') {
      alreadyMember = true
    } else if (memberCheck) {
      const { error } = await supabase
        .from('event_members')
        .update({ status: 'joined' })
        .eq('id', memberCheck.id)
      if (error) return json({ error: 'member_update_failed' }, 500)
    } else {
      const { error } = await supabase.from('event_members').insert({
        event_id: jt.event_id,
        participant_id: participantId,
        role: 'member',
        status: 'joined',
      })
      if (error) return json({ error: 'member_create_failed' }, 500)
    }

    const { error: fixErr } = await supabase.rpc('fix_event_membership_duplicates', {
      _event_id: jt.event_id,
      _profile_id: user.id,
    })
    if (fixErr) console.warn('Failed to fix duplicates:', fixErr)

    const { data: wl, error: wlErr } = await supabase
      .from('wishlists')
      .select('id')
      .eq('event_id', jt.event_id)
      .eq('owner_id', participantId)
      .maybeSingle()
    if (wlErr) return json({ error: 'wishlist_lookup_failed' }, 500)

    if (!wl) {
      const { error } = await supabase.from('wishlists').insert({
        event_id: jt.event_id,
        owner_id: participantId,
        title: 'La mia lista',
      })
      if (error) return json({ error: 'wishlist_create_failed' }, 500)
    }

    const { error: usedErr } = await supabase
      .from('join_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null)
    if (usedErr) return json({ error: 'token_update_failed' }, 500)

    return json({
      redirect: `/events/${jt.event_id}`,
      ...(alreadyMember ? { message: 'already_member' } : {}),
    })
  } catch (error) {
    console.error('Error in join-claim function:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
