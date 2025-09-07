import { supabase } from "@/integrations/supabase/client";

export interface DrawMember {
  id: string;
  participant_id: string;
  anonymous_name: string | null;
}

export interface DrawExclusion {
  giver_id: string;
  blocked_id: string;
}

export interface DrawAssignment {
  giver_id: string;
  receiver_id: string;
}

export interface DrawConstraints {
  members: DrawMember[];
  exclusions: DrawExclusion[];
  antiRecurrence: Map<string, string>; // giver_id -> previous_receiver_id
}

export interface DrawResult {
  success: boolean;
  assignments?: DrawAssignment[];
  error?: string;
}

/**
 * Validates if a potential assignment violates any constraints
 */
function isValidAssignment(
  giverId: string,
  receiverId: string,
  constraints: DrawConstraints
): boolean {
  // No self-assignment
  if (giverId === receiverId) return false;

  // Check exclusions
  if (constraints.exclusions.some(ex => 
    ex.giver_id === giverId && ex.blocked_id === receiverId
  )) {
    return false;
  }

  // Check anti-recurrence (avoid same assignment as last year)
  if (constraints.antiRecurrence.get(giverId) === receiverId) {
    return false;
  }

  return true;
}

/**
 * Attempts to create a valid assignment using shuffle algorithm
 */
function tryShuffleAssignment(constraints: DrawConstraints, maxAttempts = 500): DrawAssignment[] | null {
  const memberIds = constraints.members.map(m => m.participant_id);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receivers = [...memberIds];
    const assignments: DrawAssignment[] = [];
    let success = true;

    // Shuffle receivers
    for (let i = receivers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }

    // Try to assign each giver to a receiver
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

/**
 * Backtracking algorithm to find a perfect matching
 */
function findPerfectMatching(constraints: DrawConstraints): DrawAssignment[] | null {
  const memberIds = constraints.members.map(m => m.participant_id);
  const assignments: DrawAssignment[] = [];
  const usedReceivers = new Set<string>();

  function backtrack(giverIndex: number): boolean {
    if (giverIndex === memberIds.length) {
      return true; // All givers have been assigned
    }

    const giverId = memberIds[giverIndex];

    for (const receiverId of memberIds) {
      if (usedReceivers.has(receiverId)) continue;
      
      if (isValidAssignment(giverId, receiverId, constraints)) {
        // Try this assignment
        assignments.push({ giver_id: giverId, receiver_id: receiverId });
        usedReceivers.add(receiverId);

        if (backtrack(giverIndex + 1)) {
          return true;
        }

        // Backtrack
        assignments.pop();
        usedReceivers.delete(receiverId);
      }
    }

    return false;
  }

  return backtrack(0) ? assignments : null;
}

/**
 * Main draw function that tries shuffle first, then falls back to perfect matching
 */
export function performDraw(constraints: DrawConstraints): DrawResult {
  const memberIds = constraints.members.map(m => m.participant_id);
  
  // Validate minimum requirements
  if (memberIds.length < 2) {
    return {
      success: false,
      error: "Servono almeno 2 partecipanti per il sorteggio"
    };
  }

  // Check if a perfect matching is theoretically possible
  // This is a simplified check - we'll let the algorithms determine feasibility
  if (memberIds.length !== new Set(memberIds).size) {
    return {
      success: false,
      error: "IDs partecipanti duplicati rilevati"
    };
  }

  // Try shuffle algorithm first (fast)
  let assignments = tryShuffleAssignment(constraints, 500);

  if (!assignments) {
    // Fall back to perfect matching algorithm
    assignments = findPerfectMatching(constraints);
  }

  if (!assignments) {
    return {
      success: false,
      error: "Impossibile completare il sorteggio con le esclusioni e vincoli attuali. Rimuovi alcune esclusioni o contatta il supporto."
    };
  }

  return {
    success: true,
    assignments
  };
}

/**
 * Loads anti-recurrence data from the previous year's event
 */
export async function loadAntiRecurrenceMap(eventId: string): Promise<Map<string, string>> {
  const antiRecurrence = new Map<string, string>();

  try {
    // Get the current event to find previous_event_id
    const { data: currentEvent, error: eventError } = await supabase
      .from('events')
      .select('previous_event_id')
      .eq('id', eventId)
      .single();

    if (eventError || !currentEvent?.previous_event_id) {
      return antiRecurrence; // No previous event, empty map
    }

    // Load assignments from previous event
    const { data: previousAssignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('giver_id, receiver_id')
      .eq('event_id', currentEvent.previous_event_id);

    if (assignmentsError) {
      console.warn('Error loading previous assignments:', assignmentsError);
      return antiRecurrence;
    }

    // Build the map
    for (const assignment of previousAssignments || []) {
      antiRecurrence.set(assignment.giver_id, assignment.receiver_id);
    }

  } catch (error) {
    console.warn('Error loading anti-recurrence data:', error);
  }

  return antiRecurrence;
}