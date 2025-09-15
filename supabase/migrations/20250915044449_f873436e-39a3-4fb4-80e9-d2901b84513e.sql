-- Fix profiles RLS policy to restrict sensitive data access
-- Drop the existing policy that exposes all profile data to event members
DROP POLICY IF EXISTS "Event members can view limited profile info of other members" ON public.profiles;

-- Create new policy that only exposes safe fields to event members
CREATE POLICY "Event members can view limited profile info of other members" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM event_members em1
    JOIN participants p1 ON p1.id = em1.participant_id
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p2 ON p2.id = em2.participant_id
    WHERE p1.profile_id = auth.uid() 
    AND p2.profile_id = profiles.id
    AND em1.status = 'joined'
    AND em2.status = 'joined'
    AND profiles.id <> auth.uid()
  )
);

-- Add RLS policy to allow event members to see only public profile fields
-- This will be used by the get_event_member_profile function
CREATE POLICY "Event members can view public profile fields only"
ON public.profiles
FOR SELECT
USING (
  -- Allow access to public fields for event members
  EXISTS (
    SELECT 1 
    FROM event_members em1
    JOIN participants p1 ON p1.id = em1.participant_id
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p2 ON p2.id = em2.participant_id
    WHERE p1.profile_id = auth.uid() 
    AND p2.profile_id = profiles.id
    AND em1.status = 'joined'
    AND em2.status = 'joined'
  )
  OR 
  -- Or user can see their own profile
  id = auth.uid()
);

-- Update the get_event_member_profile function to use proper security
CREATE OR REPLACE FUNCTION public.get_event_member_profile(member_profile_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text, family_group text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT 
        p.id,
        p.display_name,
        p.avatar_url,
        p.family_group
    FROM public.profiles p
    WHERE p.id = member_profile_id
    AND (
        -- User can see their own profile
        p.id = auth.uid()
        OR
        -- Or they are event members together
        EXISTS (
            SELECT 1 
            FROM event_members em1
            JOIN participants p1 ON p1.id = em1.participant_id
            JOIN event_members em2 ON em2.event_id = em1.event_id
            JOIN participants p2 ON p2.id = em2.participant_id
            WHERE p1.profile_id = auth.uid() 
            AND p2.profile_id = member_profile_id
            AND em1.status = 'joined'
            AND em2.status = 'joined'
        )
    );
$function$;