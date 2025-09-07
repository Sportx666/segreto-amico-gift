import { createClient } from '@supabase/supabase-js';

// Use direct values since VITE_ prefixed env vars don't work in API routes
const SUPABASE_URL = "https://eociecgrdwllggcohmko.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvY2llY2dyZHdsbGdnY29obWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODc5ODcsImV4cCI6MjA3MTk2Mzk4N30.frsU_PCHKJdz8lFv2IXqOiUVFwk28hXbZGWZAoYFfBY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DrawMember {
  id: string;
  participant_id: string;
  anonymous_name: string | null;
}

interface DrawExclusion {
  giver_id: string;
  blocked_id: string;
}

interface DrawAssignment {
  giver_id: string;
  receiver_id: string;
}

interface DrawConstraints {
  members: DrawMember[];
  exclusions: DrawExclusion[];
  antiRecurrence: Map<string, string>;
}

function isValidAssignment(
  giverId: string,
  receiverId: string,
  constraints: DrawConstraints
): boolean {
  if (giverId === receiverId) return false;
  
  if (constraints.exclusions.some(ex => 
    ex.giver_id === giverId && ex.blocked_id === receiverId
  )) {
    return false;
  }
  
  if (constraints.antiRecurrence.get(giverId) === receiverId) {
    return false;
  }
  
  return true;
}

function tryShuffleAssignment(constraints: DrawConstraints, maxAttempts = 500): DrawAssignment[] | null {
  const memberIds = constraints.members.map(m => m.participant_id);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receivers = [...memberIds];
    const assignments: DrawAssignment[] = [];
    let success = true;

    for (let i = receivers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }

    for (let i = 0; i < memberIds.length; i++) {
      const giverId = memberIds[i];
      const receiverId = receivers[i];

      if (!isValidAssignment(giverId, receiverId, constraints)) {
        success = false;
        break;
      }

      assignments.push({ giver_id: giverId, receiver_id: receiverId });
    }

    if (success) {
      return assignments;
    }
  }

  return null;
}

function findPerfectMatching(constraints: DrawConstraints): DrawAssignment[] | null {
  const memberIds = constraints.members.map(m => m.participant_id);
  const assignments: DrawAssignment[] = [];
  const usedReceivers = new Set<string>();

  function backtrack(giverIndex: number): boolean {
    if (giverIndex === memberIds.length) {
      return true;
    }

    const giverId = memberIds[giverIndex];

    for (const receiverId of memberIds) {
      if (usedReceivers.has(receiverId)) continue;
      
      if (isValidAssignment(giverId, receiverId, constraints)) {
        assignments.push({ giver_id: giverId, receiver_id: receiverId });
        usedReceivers.add(receiverId);

        if (backtrack(giverIndex + 1)) {
          return true;
        }

        assignments.pop();
        usedReceivers.delete(receiverId);
      }
    }

    return false;
  }

  return backtrack(0) ? assignments : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId } = req.query;
  
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  try {
    // Verify event exists and get admin info
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, admin_profile_id, previous_event_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Load members
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select('id, participant_id, anonymous_name')
      .eq('event_id', eventId)
      .eq('status', 'joined');

    if (membersError) {
      throw membersError;
    }

    if (!members || members.length < 2) {
      return res.status(400).json({ 
        error: 'Servono almeno 2 partecipanti per il sorteggio',
        assignedCount: 0,
        skipped: []
      });
    }

    // Load exclusions
    const { data: exclusions, error: exclusionsError } = await supabase
      .from('exclusions')
      .select('giver_id, blocked_id')
      .eq('event_id', eventId)
      .eq('active', true);

    if (exclusionsError) {
      throw exclusionsError;
    }

    // Load anti-recurrence data
    const antiRecurrence = new Map<string, string>();
    if (event.previous_event_id) {
      const { data: previousAssignments } = await supabase
        .from('assignments')
        .select('giver_id, receiver_id')
        .eq('event_id', event.previous_event_id);

      for (const assignment of previousAssignments || []) {
        antiRecurrence.set(assignment.giver_id, assignment.receiver_id);
      }
    }

    // Prepare constraints
    const constraints: DrawConstraints = {
      members: members as DrawMember[],
      exclusions: (exclusions || []) as DrawExclusion[],
      antiRecurrence
    };

    // Try shuffle first, then perfect matching
    let assignments = tryShuffleAssignment(constraints, 500);
    
    if (!assignments) {
      assignments = findPerfectMatching(constraints);
    }

    if (!assignments) {
      return res.status(400).json({ 
        error: 'Impossibile completare il sorteggio con le esclusioni e vincoli attuali',
        assignedCount: 0,
        skipped: members.map(m => m.id)
      });
    }

    // Atomic transaction: delete old assignments and insert new ones
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase
      .from('assignments')
      .insert(
        assignments.map(assignment => ({
          ...assignment,
          event_id: eventId
        }))
      );

    if (insertError) {
      throw insertError;
    }

    // Update event status
    const { error: updateError } = await supabase
      .from('events')
      .update({ draw_status: 'completed' })
      .eq('id', eventId);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      assignedCount: assignments.length,
      skipped: []
    });

  } catch (error: any) {
    console.error('Draw API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Errore interno del server',
      assignedCount: 0,
      skipped: []
    });
  }
}