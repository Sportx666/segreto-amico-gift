import { describe, it, expect } from 'vitest';
import { computePairs, drawComputationError, exclusionSetFromRows, type Member } from './draw';

const makeMembers = (ids: string[]): Member[] => ids.map(id => ({ id, participantId: id }));

describe('computePairs', () => {
  it('3–6 members, no exclusions → perfect', () => {
    for (let n = 3; n <= 6; n++) {
      const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
      const members = makeMembers(ids);
      const pairs = computePairs(members, members, { exclusions: new Set() });
      expect(pairs).toHaveLength(n);
      const g = new Set(pairs.map(p => p.giver));
      const r = new Set(pairs.map(p => p.receiver));
      expect(g.size).toBe(n);
      expect(r.size).toBe(n);
      pairs.forEach(p => expect(p.giver).not.toBe(p.receiver));
    }
  });

  it('Self exclusion enforcement', () => {
    const members = makeMembers(['A', 'B', 'C']);
    const pairs = computePairs(members, members, { exclusions: new Set() });
    pairs.forEach(p => expect(p.giver).not.toBe(p.receiver));
  });

  it('Heavy exclusions causing impossibility', () => {
    const members = makeMembers(['A', 'B']);
    const exclusions = new Set(['A|B', 'B|A']);
    expect(() => computePairs(members, members, { exclusions })).toThrowError('IMPOSSIBLE');
  });

  it('Anti-recurrence: previous pairs are avoided', () => {
    const members = makeMembers(['A', 'B', 'C']);
    const anti = new Set(['A|B']);
    const pairs = computePairs(members, members, { exclusions: new Set(), antiRecurrence: anti });
    const a = pairs.find(p => p.giver === 'A');
    expect(a?.receiver).not.toBe('B');
  });

  it('treats exclusion rows as participant ids, not event member ids', () => {
    const members: Member[] = [
      { id: 'member-a', participantId: 'part-a' },
      { id: 'member-b', participantId: 'part-b' },
    ];
    const exclusions = exclusionSetFromRows([
      { giver_id: 'part-a', blocked_id: 'part-b' },
      { giver_id: 'part-b', blocked_id: 'part-a' },
    ]);
    expect(exclusions.has('part-a|part-b')).toBe(true);
    expect(exclusions.has('member-a|member-b')).toBe(false);
    expect(() => computePairs(members, members, { exclusions })).toThrowError('IMPOSSIBLE');
  });

  it('keeps a one-way participant exclusion out of the result', () => {
    const members = makeMembers(['A', 'B', 'C']);
    const exclusions = exclusionSetFromRows([{ giver_id: 'A', blocked_id: 'B' }]);
    const pairs = computePairs(members, members, { exclusions });
    expect(pairs.find(p => p.giver === 'A')?.receiver).not.toBe('B');
    pairs.forEach(p => expect(exclusions.has(`${p.giver}|${p.receiver}`)).toBe(false));
  });

  it('maps an impossible matching to 400, not 500', () => {
    const members = makeMembers(['A', 'B']);
    const exclusions = exclusionSetFromRows([
      { giver_id: 'A', blocked_id: 'B' },
      { giver_id: 'B', blocked_id: 'A' },
    ]);
    try {
      computePairs(members, members, { exclusions });
      throw new Error('expected IMPOSSIBLE');
    } catch (err) {
      const response = drawComputationError(err);
      expect(response.status).toBe(400);
      expect(response.error).toMatch(/vincoli/i);
    }
  });

  it('maps unexpected pairing errors to 500', () => {
    expect(drawComputationError(new Error('db down'))).toEqual({
      status: 500,
      error: 'Errore nel calcolo delle assegnazioni',
    });
  });
});
