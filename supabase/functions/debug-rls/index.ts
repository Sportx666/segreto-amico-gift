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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const { eventId } = await req.json()

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = authHeader.replace('Bearer ', '')

    let userId: string | null = null
    try {
      const svc = createClient(supabaseUrl, supabaseServiceKey)
      const { data: userRes, error: userErr } = await svc.auth.getUser(accessToken)
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      userId = userRes.user.id
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const checks: Record<string, any> = {}

    // Check 1: can select participants for own profile
    try {
      const { data, error } = await userClient
        .from('participants')
        .select('id')
        .eq('profile_id', userId!)
        .limit(1)
      checks.participants_select_self = { ok: !error, count: data?.length ?? 0, error: error?.message }
    } catch (e: any) {
      checks.participants_select_self = { ok: false, error: e.message }
    }

    // Check 2: can insert participants with null profile_id (what UI does for guests)
    let tempParticipantId: string | null = null
    try {
      const ins = await userClient
        .from('participants')
        .insert({ profile_id: null })
        .select('id')
        .single()
      if (ins.error) throw ins.error
      tempParticipantId = (ins.data as any)?.id ?? null
      checks.participants_insert_null = { ok: true, id: tempParticipantId }
    } catch (e: any) {
      checks.participants_insert_null = { ok: false, error: e.message }
    }

    // Check 3: can insert event_members for given event (admin-only usually)
    let tempMemberId: string | null = null
    if (eventId && tempParticipantId) {
      try {
        const ins = await userClient
          .from('event_members')
          .insert({
            event_id: eventId,
            participant_id: tempParticipantId,
            role: 'member',
            status: 'invited',
          })
          .select('id')
          .single()
        if (ins.error) throw ins.error
        tempMemberId = (ins.data as any)?.id ?? null
        checks.event_members_insert = { ok: true, id: tempMemberId }
      } catch (e: any) {
        checks.event_members_insert = { ok: false, error: e.message }
      }
    } else if (eventId) {
      checks.event_members_insert = { ok: false, skipped: true, reason: 'No temp participant to attach' }
    }

    // Cleanup if we inserted anything, via service client to bypass RLS
    try {
      const svc = createClient(supabaseUrl, supabaseServiceKey)
      if (tempMemberId) {
        await svc.from('event_members').delete().eq('id', tempMemberId)
      }
      if (tempParticipantId) {
        await svc.from('participants').delete().eq('id', tempParticipantId)
      }
    } catch {}

    return new Response(JSON.stringify({ ok: true, userId, checks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in debug-rls function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})