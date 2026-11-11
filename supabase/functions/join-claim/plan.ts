// Decides which participant row a signed-in user should join as.
// Kept free of Supabase so the cases can be unit tested.

export type TokenParticipant = { id: string; profile_id: string | null };

export type JoinPlan =
  | { type: 'forbidden' }
  | { type: 'create' }
  | { type: 'claim'; participantId: string }
  | { type: 'use'; participantId: string; mergeFrom: string | null };

export function planJoin(args: {
  userId: string;
  tokenParticipant: TokenParticipant | null;
  existingParticipantId: string | null;
}): JoinPlan {
  const { userId, tokenParticipant, existingParticipantId } = args;

  if (tokenParticipant?.profile_id && tokenParticipant.profile_id !== userId) {
    return { type: 'forbidden' };
  }

  if (!tokenParticipant) {
    if (existingParticipantId) {
      return { type: 'use', participantId: existingParticipantId, mergeFrom: null };
    }
    return { type: 'create' };
  }

  if (tokenParticipant.profile_id === userId) {
    return { type: 'use', participantId: tokenParticipant.id, mergeFrom: null };
  }

  // Invite slot is not linked to an account yet.
  if (!existingParticipantId) {
    return { type: 'claim', participantId: tokenParticipant.id };
  }

  if (existingParticipantId === tokenParticipant.id) {
    return { type: 'use', participantId: existingParticipantId, mergeFrom: null };
  }

  // The user already has their own participant. Join as that row and fold
  // the anonymous invite slot into it. Do not write profile_id onto the
  // slot: participants.profile_id is unique.
  return {
    type: 'use',
    participantId: existingParticipantId,
    mergeFrom: tokenParticipant.id,
  };
}
