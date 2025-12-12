-- Add RLS policy for participants to allow event co-members to view each other
CREATE POLICY "participants_select_event_members" ON public.participants
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_members em1
      JOIN event_members em2 ON em2.event_id = em1.event_id
      JOIN participants p ON p.id = em2.participant_id
      WHERE em1.participant_id = participants.id
        AND p.profile_id = auth.uid()
        AND em1.status = 'joined'
        AND em2.status = 'joined'
    )
  );

-- Add RLS policy for profiles to allow event co-members to view avatar_url
CREATE POLICY "profiles_select_event_members" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_members em1
      JOIN participants p1 ON p1.id = em1.participant_id
      JOIN event_members em2 ON em2.event_id = em1.event_id
      JOIN participants p2 ON p2.id = em2.participant_id
      WHERE p1.profile_id = profiles.id
        AND p2.profile_id = auth.uid()
        AND em1.status = 'joined'
        AND em2.status = 'joined'
    )
  );