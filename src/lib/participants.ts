import { supabase } from "@/integrations/supabase/client";

// Resolves the participant id for a given profile (auth) id.
// Ensures a single row exists via upsert on profile_id.
export async function getOrCreateParticipantId(profileId: string): Promise<string> {
  // Try read first
  const { data: existing, error: readErr } = await supabase
    .from("participants")
    .select("id")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();

  if (readErr) {
    console.warn("participants read error", readErr);
  }
  if (existing?.id) return existing.id;

  // Insert if missing (no onConflict required)
  const inserted = await supabase
    .from("participants")
    .insert({ profile_id: profileId })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) {
    throw inserted.error ?? new Error("Unable to create participant");
  }
  return inserted.data.id as string;
}
