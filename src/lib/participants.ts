// Replace direct usage of getOrCreateParticipantId with service
import { ParticipantService } from '@/services/participants';

// ... keep existing imports and code ...
export async function getOrCreateParticipantId(profileId: string): Promise<string> {
  return ParticipantService.getOrCreateParticipantId(profileId);
}
