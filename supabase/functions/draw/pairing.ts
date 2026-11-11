// Pure Secret Santa pairing. No Deno or Supabase imports, so unit tests and
// the Edge Function share one implementation.
export type Member = { id: string; participantId: string };
export type Pair = { giver: string; receiver: string };

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function computePairs(
  givers: Member[],
  receivers: Member[],
  opts: {
    exclusions: Set<string>; // `${giverParticipantId}|${blockedParticipantId}`
    antiRecurrence?: Set<string>;
    maxTries?: number;
  }
): Pair[] {
  const n = givers.length;
  if (n !== receivers.length) throw new Error('IMPOSSIBLE');
  const maxTries = opts.maxTries ?? 500;

  const rIds = receivers.map(r => r.participantId);
  const gIds = givers.map(g => g.participantId);

  const adj: number[][] = [];
  for (let i = 0; i < n; i++) {
    const giverId = gIds[i];
    const allowed: number[] = [];
    for (let j = 0; j < rIds.length; j++) {
      const recvId = rIds[j];
      if (giverId === recvId) continue;
      if (opts.exclusions.has(`${giverId}|${recvId}`)) continue;
      if (opts.antiRecurrence && opts.antiRecurrence.has(`${giverId}|${recvId}`)) continue;
      allowed.push(j);
    }
    if (allowed.length === 0) throw new Error('IMPOSSIBLE');
    adj.push(allowed);
  }

  const order = Array.from({ length: rIds.length }, (_, i) => i);
  for (let t = 0; t < maxTries; t++) {
    shuffle(order);
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (!adj[i].includes(order[i])) { ok = false; break; }
    }
    if (ok) {
      return givers.map((g, i) => ({ giver: g.participantId, receiver: rIds[order[i]] }));
    }
  }

  const matchR = new Array<number>(rIds.length).fill(-1);
  const seen = new Array<boolean>(rIds.length).fill(false);
  const dfs = (u: number): boolean => {
    for (const v of adj[u]) {
      if (seen[v]) continue;
      seen[v] = true;
      if (matchR[v] === -1 || dfs(matchR[v])) {
        matchR[v] = u;
        return true;
      }
    }
    return false;
  };
  for (let u = 0; u < n; u++) {
    seen.fill(false);
    if (!dfs(u)) throw new Error('IMPOSSIBLE');
  }
  const pairs: Pair[] = [];
  for (let v = 0; v < rIds.length; v++) {
    const u = matchR[v];
    if (u === -1) throw new Error('IMPOSSIBLE');
    pairs.push({ giver: gIds[u], receiver: rIds[v] });
  }
  return pairs;
}

/**
 * Exclusions are stored as participant ids (FK to participants), not
 * event_members ids. Build the set computePairs expects.
 */
export function exclusionSetFromRows(
  rows: Array<{ giver_id: string | null; blocked_id: string | null }>
): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.giver_id && row.blocked_id) {
      set.add(`${row.giver_id}|${row.blocked_id}`);
    }
  }
  return set;
}

/** Impossible constraints are a client error. Anything else is a server error. */
export function drawComputationError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : '';
  if (message === 'IMPOSSIBLE') {
    return { status: 400, error: 'Impossibile rispettare i vincoli' };
  }
  return { status: 500, error: 'Errore nel calcolo delle assegnazioni' };
}
