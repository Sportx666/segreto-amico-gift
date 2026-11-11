import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { computePairs, drawComputationError, exclusionSetFromRows, type Member } from './pairing.ts';
import { schedulerBypassAuthorized, schedulerMayDraw } from '../_shared/schedulerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Bypass only for the service role plus the scheduler secret, compared in
    // constant time. A wrong or missing secret falls through to the admin check.
    const schedulerCall = schedulerBypassAuthorized({
      authorizationHeader: req.headers.get('authorization'),
      schedulerSecretHeader: req.headers.get('x-scheduler-secret'),
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      schedulerSecret: Deno.env.get('SCHEDULER_SECRET'),
    });

    let userId: string | null = null;
    if (!schedulerCall) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    }

    // Verify user is event admin
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('admin_profile_id, draw_status, auto_draw_enabled')
      .eq('id', eventId)
      .maybeSingle();
    if (eventErr || !event) {
      console.error('Event load error', eventErr);
      return new Response(
        JSON.stringify({ error: 'Evento non trovato' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (schedulerCall) {
      if (!schedulerMayDraw(event)) {
        return new Response(
          JSON.stringify({ error: 'Sorteggio automatico non consentito per questo evento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (event.admin_profile_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Accesso negato: solo gli amministratori possono avviare il sorteggio' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Verify all participants are authenticated
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

    const giverArr: Member[] = members.map((m: any) => ({ id: m.id, participantId: m.participant_id }));
    const receiverArr: Member[] = giverArr;

    // exclusions.giver_id / blocked_id reference participants(id), the same
    // ids stored on assignments. Do not look them up as event_members ids.
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

    const exclusionSet = exclusionSetFromRows(exclusionsData || []);

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
    let pairs: { giver: string; receiver: string }[] = [];
    try {
      pairs = computePairs(giverArr, receiverArr, { exclusions: exclusionSet, antiRecurrence: antiSet });
    } catch (err: unknown) {
      const failure = drawComputationError(err);
      if (failure.status >= 500) console.error('Compute pairs error', err);
      return new Response(
        JSON.stringify({ error: failure.error }),
        { status: failure.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
