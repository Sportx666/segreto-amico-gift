import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)

    const accessToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !user) return json({ error: 'unauthorized' }, 401)

    const { token } = await req.json().catch(() => ({ token: null }))
    if (!token) return json({ error: 'token_required' }, 400)

    const { data, error } = await supabase.rpc('claim_join_token', {
      _token: token,
      _profile_id: user.id,
    })

    if (error) {
      console.error('claim_join_token failed:', error)
      // The function raises only after it has decided to abort the transaction,
      // so used_at is not left set.
      return json({ error: 'claim_failed' }, 500)
    }

    const payload = (data ?? {}) as { error?: string; redirect?: string; already_member?: boolean }
    if (payload.error === 'invalid') return json({ error: 'invalid' }, 400)
    if (payload.error === 'used') return json({ error: 'used' }, 400)
    if (payload.error === 'expired') return json({ error: 'expired' }, 400)
    if (payload.error === 'forbidden') return json({ error: 'forbidden' }, 403)
    if (!payload.redirect) return json({ error: 'claim_failed' }, 500)

    return json({
      redirect: payload.redirect,
      ...(payload.already_member ? { message: 'already_member' } : {}),
    })
  } catch (error) {
    console.error('Error in join-claim function:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
