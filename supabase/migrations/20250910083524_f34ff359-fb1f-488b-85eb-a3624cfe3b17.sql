-- Fix Security Definer Views issue by removing SECURITY DEFINER property
-- The views will inherit security from their underlying tables which already have proper RLS

-- Drop existing views with SECURITY DEFINER
DROP VIEW IF EXISTS public.v_assignment_members;
DROP VIEW IF EXISTS public.v_exclusion_members;

-- Recreate v_assignment_members view as a regular view (without SECURITY DEFINER)
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

-- Recreate v_exclusion_members view as a regular view (without SECURITY DEFINER)
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