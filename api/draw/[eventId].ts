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
    console.error('Supabase service client creation failed:', e);
    return res.status(500).json({ error: e.message || 'Server configuration error' });
  }

  console.log('Starting draw for event:', eventId);

  try {
    // Load members
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select('id, participant_id')
      .eq('event_id', eventId)
      .eq('status', 'joined');
    if (membersError) throw membersError;
    if (!members || members.length < 2) {
      return res.status(400).json({ error: 'Servono almeno 2 partecipanti per il sorteggio' });
    }
    const giverArr: Member[] = members.map(m => ({ id: m.id, participantId: m.participant_id }));
    const receiverArr: Member[] = giverArr;
    const memberToParticipant = new Map<string, string>();
    giverArr.forEach(m => memberToParticipant.set(m.id, m.participantId));

    // Load exclusions (giver_id and blocked_id are already participant IDs)
    const { data: exclusions } = await supabase
      .from('exclusions')
      .select('giver_id, blocked_id')
      .eq('event_id', eventId)
      .eq('active', true);
    const exclusionSet = new Set<string>();
    (exclusions || []).forEach(ex => {
      if (ex.giver_id && ex.blocked_id) {
        exclusionSet.add(`${ex.giver_id}|${ex.blocked_id}`);
      }
    });
    console.log('Loaded exclusions:', exclusions?.length || 0, 'active exclusions');

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
    console.error('Draw error for event', eventId, ':', error);
    return res.status(500).json({ 
      error: error.message || 'Errore interno del server',
      details: error.code || error.name || 'Unknown error type'
    });
  }
}
