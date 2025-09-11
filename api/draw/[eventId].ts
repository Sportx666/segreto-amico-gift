import { createServiceClient } from '../_supabase';
import { computePairs, type Member, type Pair } from '../../src/lib/draw';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { eventId } = req.query;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Server configuration error' });
  }

  try {
    // Check DEV bypass flag (server-side only)
    const devBypass = process.env.DEV_ALLOW_UNAUTH_DRAW === '1';
    
    // Load members with their profile information for validation
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
    if (membersError) throw membersError;
    if (!members || members.length < 2) {
      return res.status(400).json({ error: 'Servono almeno 2 partecipanti per il sorteggio' });
    }

    // Validate that all participants have authenticated profiles (unless dev bypass is enabled)
    if (!devBypass) {
      const unauthenticatedParticipants: string[] = [];
      
      for (const member of members) {
        const participant = member.participants;
        if (!participant?.profile_id || !participant.profiles) {
          const displayName = participant?.profiles?.display_name || 'Partecipante senza nome';
          unauthenticatedParticipants.push(displayName);
        }
      }
      
      if (unauthenticatedParticipants.length > 0) {
        return res.status(400).json({ 
          error: `Impossibile eseguire il sorteggio. I seguenti partecipanti non hanno un account autenticato: ${unauthenticatedParticipants.join(', ')}. Invitali a registrarsi prima di procedere con il sorteggio.`
        });
      }
    }

    const giverArr: Member[] = members.map(m => ({ id: m.id, participantId: m.participant_id }));
    const receiverArr: Member[] = giverArr;
    const memberToParticipant = new Map<string, string>();
    giverArr.forEach(m => memberToParticipant.set(m.id, m.participantId));

    // Load exclusions
    const { data: exclusions } = await supabase
      .from('exclusions')
      .select('giver_id, blocked_id')
      .eq('event_id', eventId)
      .eq('active', true);
    const exclusionSet = new Set<string>();
    (exclusions || []).forEach(ex => {
      const g = memberToParticipant.get(ex.giver_id);
      const r = memberToParticipant.get(ex.blocked_id);
      if (g && r) exclusionSet.add(`${g}|${r}`);
    });

    // Anti-recurrence
    const antiSet = new Set<string>();
    const { data: event } = await supabase
      .from('events')
      .select('previous_event_id')
      .eq('id', eventId)
      .maybeSingle();
    if (event?.previous_event_id) {      
      const { data: prevAssign } = await supabase
        .from('assignments')
        .select('giver_id, receiver_id')
        .eq('event_id', event.previous_event_id);
      (prevAssign || []).forEach(a => {
        if (a.giver_id && a.receiver_id) {
          antiSet.add(`${a.giver_id}|${a.receiver_id}`);
        }
      });
    }

    let pairs: Pair[];
    try {
      pairs = computePairs(giverArr, receiverArr, {
        exclusions: exclusionSet,
        antiRecurrence: antiSet
      });
    } catch (err: any) {
      if (err.message === 'IMPOSSIBLE') {
        return res.status(400).json({ error: 'Impossibile rispettare i vincoli' });
      }
      throw err;
    }

    // Persist assignments
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('event_id', eventId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from('assignments')
      .insert(
        pairs.map(p => ({
          event_id: eventId,
          giver_id: p.giver,
          receiver_id: p.receiver
        }))
      );
    if (insertError) throw insertError;

    const { error: updateEventError } = await supabase
      .from('events')
      .update({draw_status: 'completed' })
      .eq('id', eventId);
    if (updateEventError) throw updateEventError;

    return res.status(200).json({ assignedCount: pairs.length });
  } catch (error: any) {
    console.error('draw error', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
