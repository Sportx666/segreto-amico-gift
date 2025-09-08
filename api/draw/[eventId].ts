import { createServiceClient } from '../_supabase.ts';
import { computePairs, type Member, type Pair } from '../../src/lib/draw.ts';

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
      const { data: prevMembers } = await supabase
        .from('event_members')
        .select('id, participant_id')
        .eq('event_id', event.previous_event_id);
      const prevMap = new Map<string, string>();
      (prevMembers || []).forEach(m => prevMap.set(m.id, m.participant_id));
      const { data: prevAssign } = await supabase
        .from('assignments')
        .select('giver_id, receiver_id')
        .eq('event_id', event.previous_event_id);
      (prevAssign || []).forEach(a => {
        const g = prevMap.get(a.giver_id);
        const r = prevMap.get(a.receiver_id);
        if (g && r) antiSet.add(`${g}|${r}`);
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

    // Atomic write via RPC
    const { error: applyError } = await supabase.rpc('apply_assignments', {
      event_id: eventId,
      pairs
    });
    if (applyError) throw applyError;

    return res.status(200).json({ assignedCount: pairs.length });
  } catch (error: any) {
    console.error('draw error', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
