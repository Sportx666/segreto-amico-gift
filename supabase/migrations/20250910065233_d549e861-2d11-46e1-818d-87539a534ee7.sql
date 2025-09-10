-- Tighten RLS policies on assignments - no one can see full mapping, only their own assignment
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;

-- Members can only see assignments where they are the giver (their target)
CREATE POLICY "Members can only see their own assignment" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = assignments.giver_id 
        AND p.profile_id = auth.uid()
    )
  );

-- Remove admin's broader read access - admins can only run draws, not see mappings
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
CREATE POLICY "assignments_update" ON public.assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = assignments.event_id 
        AND e.admin_profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = assignments.event_id 
        AND e.admin_profile_id = auth.uid()
    )
  );

-- Add reveal_shown flag to event_members to track one-time reveal animation
ALTER TABLE public.event_members 
ADD COLUMN IF NOT EXISTS reveal_shown boolean DEFAULT false;