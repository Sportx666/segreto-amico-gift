-- Drop the restrictive policy
DROP POLICY IF EXISTS "event_members_select" ON public.event_members;

-- Create updated policy that allows joined members to see all event members
CREATE POLICY "event_members_select" ON public.event_members
  FOR SELECT
  USING (
    is_event_admin(event_id, auth.uid()) 
    OR 
    is_event_participant(event_id, auth.uid())
  );