import { describe, it, expect } from 'vitest';
import { computePairs, type Member } from './draw';

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
});
