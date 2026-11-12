import { describe, it, expect } from 'vitest';
import { computePairs, pairKey } from '../../../supabase/functions/_shared/pairing';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `participant-${i}`);

function assertValidDerangement(participants: string[], pairs: { giver: string; receiver: string }[]) {
  expect(pairs).toHaveLength(participants.length);
  expect(new Set(pairs.map((p) => p.giver))).toEqual(new Set(participants));
  expect(new Set(pairs.map((p) => p.receiver))).toEqual(new Set(participants));
  pairs.forEach((p) => expect(p.giver).not.toBe(p.receiver));
}

describe('computePairs (draw edge function)', () => {
  it('produces a valid draw for 2–12 participants', () => {
    for (let n = 2; n <= 12; n++) {
      const p = ids(n);
      assertValidDerangement(p, computePairs(p));
    }
  });

  it('never assigns an excluded pair (keys are participant ids)', () => {
    const p = ids(5);
    // participant-0 must never give to participant-1 or participant-2
    const exclusions = new Set([pairKey(p[0], p[1]), pairKey(p[0], p[2])]);
    for (let run = 0; run < 300; run++) {
      const pairs = computePairs(p, { exclusions });
      assertValidDerangement(p, pairs);
      const zero = pairs.find((x) => x.giver === p[0])!;
      expect([p[1], p[2]]).not.toContain(zero.receiver);
    }
  });

  it('finds the single remaining valid draw under heavy exclusions', () => {
    const [a, b, c] = ids(3);
    // Only a→b→c→a is allowed.
    const exclusions = new Set([pairKey(a, c), pairKey(b, a), pairKey(c, b)]);
    const pairs = computePairs([a, b, c], { exclusions });
    const map = Object.fromEntries(pairs.map((x) => [x.giver, x.receiver]));
    expect(map).toEqual({ [a]: b, [b]: c, [c]: a });
  });

  it('throws IMPOSSIBLE when exclusions cannot be satisfied', () => {
    const [a, b] = ids(2);
    expect(() => computePairs([a, b], { exclusions: new Set([pairKey(a, b)]) })).toThrowError('IMPOSSIBLE');
    expect(() => computePairs([a])).toThrowError('IMPOSSIBLE');
  });

  it('avoids last year’s pairs when possible', () => {
    const p = ids(6);
    const lastYear = new Set(p.map((g, i) => pairKey(g, p[(i + 1) % p.length])));
    for (let run = 0; run < 100; run++) {
      const pairs = computePairs(p, { antiRecurrence: lastYear });
      assertValidDerangement(p, pairs);
      pairs.forEach((x) => expect(lastYear.has(pairKey(x.giver, x.receiver))).toBe(false));
    }
  });

  it('relaxes anti-recurrence instead of failing when it makes the draw impossible', () => {
    const [a, b] = ids(2);
    const pairs = computePairs([a, b], { antiRecurrence: new Set([pairKey(a, b), pairKey(b, a)]) });
    assertValidDerangement([a, b], pairs);
  });
});
