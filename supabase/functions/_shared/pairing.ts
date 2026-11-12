// Secret Santa pairing. Pure logic (no Deno/Supabase APIs) so it can be unit tested.
//
// All ids are participant ids. `exclusions` and `antiRecurrence` hold
// "giverParticipantId|receiverParticipantId" keys.

export interface Pair {
  giver: string;
  receiver: string;
}

export interface PairingOptions {
  exclusions?: Set<string>;
  antiRecurrence?: Set<string>;
  maxTries?: number;
  random?: () => number;
}

export const pairKey = (giver: string, receiver: string) => `${giver}|${receiver}`;

/** Uniform random float in [0, 1) from the platform CSPRNG. */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function shuffle<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Assign every participant exactly one receiver (never themselves),
 * honouring exclusions. Anti-recurrence (last year's pairs) is honoured
 * when possible and dropped only if no valid draw exists with it.
 * Throws Error('IMPOSSIBLE') when the exclusions cannot be satisfied.
 */
export function computePairs(participantIds: string[], opts: PairingOptions = {}): Pair[] {
  const ids = [...new Set(participantIds)];
  if (ids.length < 2) throw new Error('IMPOSSIBLE');

  const exclusions = opts.exclusions ?? new Set<string>();
  const anti = opts.antiRecurrence ?? new Set<string>();

  try {
    return match(ids, (g, r) => g !== r && !exclusions.has(pairKey(g, r)) && !anti.has(pairKey(g, r)), opts);
  } catch (e) {
    if (anti.size === 0) throw e;
    return match(ids, (g, r) => g !== r && !exclusions.has(pairKey(g, r)), opts);
  }
}

function match(ids: string[], allowedEdge: (g: string, r: string) => boolean, opts: PairingOptions): Pair[] {
  const random = opts.random ?? secureRandom;
  const maxTries = opts.maxTries ?? 200;
  const allowed = new Map<string, string[]>(ids.map((g) => [g, ids.filter((r) => allowedEdge(g, r))]));

  // Fast path: randomized greedy attempts.
  for (let t = 0; t < maxTries; t++) {
    const givers = [...ids];
    shuffle(givers, random);
    const used = new Set<string>();
    const result: Pair[] = [];
    for (const g of givers) {
      const options = [...(allowed.get(g) ?? [])];
      shuffle(options, random);
      const choice = options.find((r) => !used.has(r));
      if (!choice) break;
      used.add(choice);
      result.push({ giver: g, receiver: choice });
    }
    if (result.length === ids.length) return result;
  }

  // Fallback: Kuhn's augmenting-path matching on a shuffled graph.
  const index = new Map(ids.map((id, i) => [id, i]));
  const graph = ids.map((g) => {
    const opts2 = (allowed.get(g) ?? []).map((r) => index.get(r)!);
    shuffle(opts2, random);
    return opts2;
  });
  const matchR: number[] = Array(ids.length).fill(-1);

  const dfs = (u: number, seen: boolean[]): boolean => {
    for (const v of graph[u]) {
      if (seen[v]) continue;
      seen[v] = true;
      if (matchR[v] === -1 || dfs(matchR[v], seen)) {
        matchR[v] = u;
        return true;
      }
    }
    return false;
  };

  for (let u = 0; u < ids.length; u++) {
    if (!dfs(u, Array(ids.length).fill(false))) throw new Error('IMPOSSIBLE');
  }

  return matchR.map((u, v) => ({ giver: ids[u], receiver: ids[v] }));
}
