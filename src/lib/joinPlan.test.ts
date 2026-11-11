import { describe, expect, it } from 'vitest';
import { planJoin } from '../../supabase/functions/join-claim/plan';

const userId = 'user-1';

describe('planJoin', () => {
  it('claims an unlinked invite when the user has no participant yet', () => {
    expect(planJoin({
      userId,
      tokenParticipant: { id: 'slot', profile_id: null },
      existingParticipantId: null,
    })).toEqual({ type: 'claim', participantId: 'slot' });
  });

  it('keeps the existing participant and merges the anonymous slot', () => {
    expect(planJoin({
      userId,
      tokenParticipant: { id: 'slot', profile_id: null },
      existingParticipantId: 'mine',
    })).toEqual({ type: 'use', participantId: 'mine', mergeFrom: 'slot' });
  });

  it('refuses an invite already linked to someone else', () => {
    expect(planJoin({
      userId,
      tokenParticipant: { id: 'slot', profile_id: 'other-user' },
      existingParticipantId: 'mine',
    })).toEqual({ type: 'forbidden' });
  });

  it('uses the token participant when it is already this user', () => {
    expect(planJoin({
      userId,
      tokenParticipant: { id: 'mine', profile_id: userId },
      existingParticipantId: 'mine',
    })).toEqual({ type: 'use', participantId: 'mine', mergeFrom: null });
  });

  it('reuses an existing participant for a generic invite', () => {
    expect(planJoin({
      userId,
      tokenParticipant: null,
      existingParticipantId: 'mine',
    })).toEqual({ type: 'use', participantId: 'mine', mergeFrom: null });
  });

  it('creates a participant for a generic invite when the user has none', () => {
    expect(planJoin({
      userId,
      tokenParticipant: null,
      existingParticipantId: null,
    })).toEqual({ type: 'create' });
  });
});
