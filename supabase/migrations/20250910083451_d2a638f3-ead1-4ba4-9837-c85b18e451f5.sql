-- Fix Security Definer Views issue
-- Drop and recreate views without SECURITY DEFINER property

-- Drop existing views
DROP VIEW IF EXISTS public.v_assignment_members;
DROP VIEW IF EXISTS public.v_exclusion_members;

-- Recreate v_assignment_members view without SECURITY DEFINER
CREATE VIEW public.v_assignment_members AS
SELECT 
    a.id,
    a.event_id,
    gm.id AS giver_member_id,
    rm.id AS receiver_member_id,
    a.generated_on
FROM assignments a
JOIN event_members gm ON (gm.event_id = a.event_id AND gm.participant_id = a.giver_id)
JOIN event_members rm ON (rm.event_id = a.event_id AND rm.participant_id = a.receiver_id);

-- Recreate v_exclusion_members view without SECURITY DEFINER
CREATE VIEW public.v_exclusion_members AS
SELECT 
    e.id,
    e.event_id,
    gm.id AS giver_member_id,
    rm.id AS blocked_member_id,
    e.reason,
    e.created_at
FROM exclusions e
JOIN event_members gm ON (gm.event_id = e.event_id AND gm.participant_id = e.giver_id)
JOIN event_members rm ON (rm.event_id = e.event_id AND rm.participant_id = e.blocked_id)
WHERE e.active = true;

-- Enable Row Level Security on the views
ALTER VIEW public.v_assignment_members SET (security_barrier = true);
ALTER VIEW public.v_exclusion_members SET (security_barrier = true);

-- Create RLS policies for v_assignment_members
-- Users can only see assignment member data for events they are members of or admin
CREATE POLICY "view_assignment_members_policy" ON public.v_assignment_members
FOR SELECT 
USING (
    is_event_admin(event_id, auth.uid()) OR 
    is_event_member(event_id, auth.uid())
);

-- Create RLS policies for v_exclusion_members  
-- Users can only see exclusion member data for events they are members of or admin
CREATE POLICY "view_exclusion_members_policy" ON public.v_exclusion_members
FOR SELECT 
USING (
    is_event_admin(event_id, auth.uid()) OR 
    is_event_member(event_id, auth.uid())
);

-- Enable RLS on both views
ALTER VIEW public.v_assignment_members ENABLE ROW LEVEL SECURITY;
ALTER VIEW public.v_exclusion_members ENABLE ROW LEVEL SECURITY;