/**
 * Participant service - centralized participant operations
 */
import { supabase } from '@/integrations/supabase/client';
import { ApiService } from './api';

export class ParticipantService {
  /**
   * Get or create participant for a profile ID
   */
  static async getOrCreateParticipantId(profileId: string): Promise<string> {
    // Try read first
    const existing = await ApiService.supabaseQuery(
      'participant_lookup',
      async () => {
        const result = await supabase
          .from("participants")
          .select("id")
          .eq("profile_id", profileId)
          .limit(1)
          .maybeSingle();
        return result;
      }
    );

    if (existing?.id) {
      return existing.id;
    }

    // Insert if missing
    const inserted = await ApiService.supabaseQuery(
      'participant_create',
      async () => {
        const result = await supabase
          .from("participants")
          .insert({ profile_id: profileId })
          .select("id")
          .single();
        return result;
      }
    );

    if (!inserted?.id) {
      throw new Error("Unable to create participant");
    }

    return inserted.id;
  }

  /**
   * Get participant by profile ID
   */
  static async getParticipantByProfileId(profileId: string): Promise<string | null> {
    try {
      const participant = await ApiService.supabaseQuery(
        'participant_by_profile',
        async () => {
          const result = await supabase
            .from("participants")
            .select("id")
            .eq("profile_id", profileId)
            .single();
          return result;
        }
      );

      return participant?.id || null;
    } catch (error) {
      return null; // Not found
    }
  }
}