import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { computePairs, pairKey } from '../_shared/pairing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { eventId } = await req.json().catch(() => ({ eventId: null }));
    if (!eventId || typeof eventId !== 'string') return json({ error: 'Event ID required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Two kinds of caller:
    //  - the auto-draw scheduler, identified by the shared scheduler secret
    //  - a signed-in user, who must be the event admin
    const schedulerSecret = Deno.env.get('SCHEDULER_SECRET');
    const providedSecret = req.headers.get('x-scheduler-secret');
    const isScheduler = !!schedulerSecret && providedSecret === schedulerSecret;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('admin_profile_id, previous_event_id')
      .eq('id', eventId)
      .maybeSingle();
    if (eventErr || !event) {
      console.error('Event load error', eventErr);
      return json({ error: 'Evento non trovato' }, 404);
    }

    if (!isScheduler) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authError || !user) return json({ error: 'Invalid authentication' }, 401);
      if (event.admin_profile_id !== user.id) {
        return json({ error: 'Accesso negato: solo gli amministratori possono avviare il sorteggio' }, 403);
      }
    }

    // Joined members with their account
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select('participant_id, anonymous_name, participants ( profile_id )')
      .eq('event_id', eventId)
      .eq('status', 'joined');

    if (membersError) {
      console.error('Members error', membersError);
      return json({ error: 'Errore nel caricare i partecipanti' }, 500);
    }
    if (!members || members.length < 2) {
      return json({ error: 'Servono almeno 2 partecipanti per il sorteggio' }, 400);
    }

    // deno-lint-ignore no-explicit-any
    const unauthenticated = (members as any[])
      .filter((m) => !m.participants?.profile_id)
      .map((m) => m.anonymous_name || 'Partecipante senza nome');
    if (unauthenticated.length > 0) {
      return json({
        error: `Impossibile eseguire il sorteggio. I seguenti partecipanti non hanno un account autenticato: ${unauthenticated.join(', ')}. Invitali a registrarsi prima di procedere con il sorteggio.`,
      }, 400);
    }

    const participantIds = members.map((m) => m.participant_id as string);
    const inEvent = new Set(participantIds);

    // Exclusions store participant ids (giver_id / blocked_id -> participants.id).
    const { data: exclusionsData, error: exclusionsError } = await supabase
      .from('exclusions')
      .select('giver_id, blocked_id')
      .eq('event_id', eventId)
      .eq('active', true);
    if (exclusionsError) {
      console.error('Exclusions error', exclusionsError);
      return json({ error: 'Errore nel caricare le esclusioni' }, 500);
    }
    const exclusions = new Set<string>();
    for (const ex of exclusionsData ?? []) {
      if (ex.giver_id && ex.blocked_id && inEvent.has(ex.giver_id) && inEvent.has(ex.blocked_id)) {
        exclusions.add(pairKey(ex.giver_id, ex.blocked_id));
      }
    }

    // Avoid repeating last year's pairs when possible
    const antiRecurrence = new Set<string>();
    if (event.previous_event_id) {
      const { data: prevAssign, error: prevErr } = await supabase
        .from('assignments')
        .select('giver_id, receiver_id')
        .eq('event_id', event.previous_event_id);
      if (prevErr) console.error('Prev assignments error', prevErr);
      for (const a of prevAssign ?? []) {
        if (a.giver_id && a.receiver_id) antiRecurrence.add(pairKey(a.giver_id, a.receiver_id));
      }
    }

    let pairs;
    try {
      pairs = computePairs(participantIds, { exclusions, antiRecurrence });
    } catch (err) {
      if (err instanceof Error && err.message === 'IMPOSSIBLE') {
        return json({ error: 'Impossibile rispettare i vincoli' }, 400);
      }
      console.error('Compute pairs error', err);
      return json({ error: 'Errore nel calcolo delle assegnazioni' }, 500);
    }

    const { error: deleteError } = await supabase.from('assignments').delete().eq('event_id', eventId);
    if (deleteError) {
      console.error('Delete assignments error', deleteError);
      return json({ error: 'Errore nel ripulire le assegnazioni' }, 500);
    }

    const { error: insertError } = await supabase
      .from('assignments')
      .insert(pairs.map((p) => ({ event_id: eventId, giver_id: p.giver, receiver_id: p.receiver, first_reveal_pending: true })));
    if (insertError) {
      console.error('Insert assignments error', insertError);
      return json({ error: 'Errore nel salvare le assegnazioni' }, 500);
    }

    const { error: updateEventError } = await supabase
      .from('events')
      .update({ draw_status: 'completed' })
      .eq('id', eventId);
    if (updateEventError) {
      console.error('Update event error', updateEventError);
      return json({ error: "Errore nell'aggiornare lo stato dell'evento" }, 500);
    }

    return json({ assignedCount: pairs.length });
  } catch (error) {
    console.error('draw function error', error);
    return json({ error: 'Errore interno del server' }, 500);
  }
});
