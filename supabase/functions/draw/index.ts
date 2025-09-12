import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for internal pairing
interface Member { id: string; participantId: string }
interface Pair { giver: string; receiver: string }

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function computePairs(
  givers: Member[],
  receivers: Member[],
  opts: { exclusions: Set<string>; antiRecurrence?: Set<string>; maxTries?: number }
): Pair[] {
  if (givers.length !== receivers.length) {
    throw new Error('IMPOSSIBLE');
  }
  const n = givers.length;
  const exclusions = opts.exclusions;
  const anti = opts.antiRecurrence || new Set<string>();
  const maxTries = opts.maxTries ?? 200;

  // Build allowed edges adjacency list by participantId
  const giverIds = givers.map(g => g.participantId);
  const receiverIds = receivers.map(r => r.participantId);

  const allowed: Map<string, string[]> = new Map();
  for (const g of giverIds) {
    const candidates = receiverIds.filter(r => r !== g && !exclusions.has(`${g}|${r}`) && !anti.has(`${g}|${r}`));
    allowed.set(g, candidates);
  }

  // Quick randomized attempts
  for (let t = 0; t < maxTries; t++) {
    const assignment = new Map<string, string>(); // giver->receiver
    const used = new Set<string>();
    for (const g of giverIds) {
      const options = [...(allowed.get(g) || [])];
      shuffle(options);
      const choice = options.find(r => !used.has(r));
      if (!choice) { assignment.clear(); break; }
      assignment.set(g, choice);
      used.add(choice);
    }
    if (assignment.size === n) {
      return Array.from(assignment.entries()).map(([giver, receiver]) => ({ giver, receiver }));
    }
  }

  // Kuhn's algorithm for perfect matching
  const gIndex = new Map<string, number>();
  const rIndex = new Map<string, number>();
  giverIds.forEach((g, i) => gIndex.set(g, i));
  receiverIds.forEach((r, i) => rIndex.set(r, i));

  const graph: number[][] = giverIds.map(g => (allowed.get(g) || []).map(r => rIndex.get(r)!).filter(i => i !== undefined));
  const matchR: number[] = Array(receiverIds.length).fill(-1);

  function dfs(u: number, seen: boolean[]): boolean {
    for (const v of graph[u]) {
      if (seen[v]) continue;
      seen[v] = true;
      if (matchR[v] === -1 || dfs(matchR[v], seen)) {
        matchR[v] = u;
        return true;
      }
    }
    return false;
  }

  let matchCount = 0;
  for (let u = 0; u < giverIds.length; u++) {
    const seen = Array(receiverIds.length).fill(false);
    if (dfs(u, seen)) matchCount++;
  }

  if (matchCount !== n) {
    throw new Error('IMPOSSIBLE');
  }

  const pairs: Pair[] = [];
  for (let v = 0; v < receiverIds.length; v++) {
    const u = matchR[v];
    if (u !== -1) {
      pairs.push({ giver: giverIds[u], receiver: receiverIds[v] });
    }
  }
  return pairs;
}

Deno.serve(async (req: Request) => {
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
    const { eventId } = await req.json().catch(() => ({ eventId: null }));
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'Event ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const devBypass = (Deno.env.get('DEV_ALLOW_UNAUTH_DRAW') || '').trim() === '1';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader && !devBypass) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        if (!devBypass) {
          return new Response(
            JSON.stringify({ error: 'Invalid authentication' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        userId = user.id;
      }
    }

    // Verify user is event admin (unless dev bypass)
    if (!devBypass) {
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .select('admin_profile_id')
        .eq('id', eventId)
        .maybeSingle();
      if (eventErr || !event) {
        console.error('Event load error', eventErr);
        return new Response(
          JSON.stringify({ error: 'Evento non trovato' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!userId || event.admin_profile_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Accesso negato: solo gli amministratori possono avviare il sorteggio' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load members (joined only) with profile info
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select(`
        id,
        participant_id,
        participants (
          id,
          profile_id,
          profiles (
            id,
            display_name
          )
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'joined');

    if (membersError) {
      console.error('Members error', membersError);
      return new Response(
        JSON.stringify({ error: 'Errore nel caricare i partecipanti' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!members || members.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Servono almeno 2 partecipanti per il sorteggio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!devBypass) {
      const unauthenticated: string[] = [];
      for (const m of members as any[]) {
        const participant = (m as any).participants;
        const hasProfile = participant?.profile_id && participant?.profiles;
        if (!hasProfile) {
          const displayName = participant?.profiles?.display_name || 'Partecipante senza nome';
          unauthenticated.push(displayName);
        }
      }
      if (unauthenticated.length > 0) {
        return new Response(
          JSON.stringify({ error: `Impossibile eseguire il sorteggio. I seguenti partecipanti non hanno un account autenticato: ${unauthenticated.join(', ')}. Invitali a registrarsi prima di procedere con il sorteggio.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const giverArr: Member[] = members.map((m: any) => ({ id: m.id, participantId: m.participant_id }));
    const receiverArr: Member[] = giverArr;

    const memberToParticipant = new Map<string, string>();
    giverArr.forEach(m => memberToParticipant.set(m.id, m.participantId));

    // Load exclusions (by member id) -> convert to participant pairs
    const { data: exclusionsData, error: exclusionsError } = await supabase
      .from('exclusions')
      .select('giver_id, blocked_id')
      .eq('event_id', eventId)
      .eq('active', true);

    if (exclusionsError) {
      console.error('Exclusions error', exclusionsError);
      return new Response(
        JSON.stringify({ error: 'Errore nel caricare le esclusioni' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exclusionSet = new Set<string>();
    (exclusionsData || []).forEach((ex: any) => {
      const g = memberToParticipant.get(ex.giver_id);
      const r = memberToParticipant.get(ex.blocked_id);
      if (g && r) exclusionSet.add(`${g}|${r}`);
    });

    // Anti-recurrence from previous event assignments
    const { data: eventRow } = await supabase
      .from('events')
      .select('previous_event_id')
      .eq('id', eventId)
      .maybeSingle();

    const antiSet = new Set<string>();
    if (eventRow?.previous_event_id) {
      const { data: prevAssign, error: prevErr } = await supabase
        .from('assignments')
        .select('giver_id, receiver_id')
        .eq('event_id', eventRow.previous_event_id);
      if (prevErr) {
        console.error('Prev assignments error', prevErr);
      }
      (prevAssign || []).forEach((a: any) => {
        if (a.giver_id && a.receiver_id) {
          antiSet.add(`${a.giver_id}|${a.receiver_id}`);
        }
      });
    }

    // Compute pairs
    let pairs: Pair[] = [];
    try {
      pairs = computePairs(giverArr, receiverArr, { exclusions: exclusionSet, antiRecurrence: antiSet });
    } catch (err: any) {
      if (err?.message === 'IMPOSSIBLE') {
        return new Response(
          JSON.stringify({ error: 'Impossibile rispettare i vincoli' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Compute pairs error', err);
      return new Response(
        JSON.stringify({ error: 'Errore nel calcolo delle assegnazioni' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Persist assignments (idempotent per event)
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('event_id', eventId);
    if (deleteError) {
      console.error('Delete assignments error', deleteError);
      return new Response(
        JSON.stringify({ error: 'Errore nel ripulire le assegnazioni' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await supabase
      .from('assignments')
      .insert(pairs.map(p => ({ event_id: eventId, giver_id: p.giver, receiver_id: p.receiver, first_reveal_pending: true })));
    if (insertError) {
      console.error('Insert assignments error', insertError);
      return new Response(
        JSON.stringify({ error: 'Errore nel salvare le assegnazioni' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateEventError } = await supabase
      .from('events')
      .update({ draw_status: 'completed' })
      .eq('id', eventId);
    if (updateEventError) {
      console.error('Update event error', updateEventError);
      return new Response(
        JSON.stringify({ error: "Errore nell'aggiornare lo stato dell'evento" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ assignedCount: pairs.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('draw function error', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Errore interno del server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
