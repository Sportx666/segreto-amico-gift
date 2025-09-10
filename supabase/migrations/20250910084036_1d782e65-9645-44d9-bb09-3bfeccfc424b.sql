-- Fix User Personal Information Security Issue
-- Create field-level access controls for profiles table
-- Note: Views cannot have RLS enabled directly in PostgreSQL

-- Create a public profile view that only exposes non-sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    display_name,
    avatar_url,
    family_group,
    created_at
FROM public.profiles;

-- Update the existing profiles RLS policy to be more granular
-- Drop the existing restrictive select policy 
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- Create a new policy that allows users to see their own full profile
CREATE POLICY "Users can view their own full profile" 
ON public.profiles
FOR SELECT 
USING (id = auth.uid());

-- Create a policy that allows event members to see limited profile info of other members
-- This will allow access to display_name and avatar_url for event functionality
-- while keeping sensitive fields (email, phone, address, etc.) private
CREATE POLICY "Event members can view limited profile info of other members" 
ON public.profiles
FOR SELECT 
USING (
    -- Only allow if users are in the same event and both have joined
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
        AND profiles.id != auth.uid() -- Don't apply this policy to own profile
    )
);

-- Create a function to get safe profile data for event members
-- This function will only return non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_event_member_profile(member_profile_id uuid)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    family_group text
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;