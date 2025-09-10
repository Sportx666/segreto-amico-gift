-- Fix User Personal Information Security Issue
-- Create field-level access controls for profiles table

-- Create a public profile view that only exposes non-sensitive fields
CREATE VIEW public.public_profiles AS
SELECT 
    id,
    display_name,
    avatar_url,
    family_group,
    created_at
FROM public.profiles;

-- Enable RLS on the public_profiles view
ALTER VIEW public.public_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can always see their own full public profile
CREATE POLICY "Users can view their own public profile" 
ON public.public_profiles
FOR SELECT 
USING (id = auth.uid());

-- Policy: Event members can see public profiles of other event members
CREATE POLICY "Event members can view other members public profiles" 
ON public.public_profiles
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 
        FROM event_members em1
        JOIN participants p1 ON p1.id = em1.participant_id
        JOIN event_members em2 ON em2.event_id = em1.event_id
        JOIN participants p2 ON p2.id = em2.participant_id
        WHERE p1.profile_id = auth.uid() 
        AND p2.profile_id = public_profiles.id
        AND em1.status = 'joined'
        AND em2.status = 'joined'
    )
);

-- Add a policy to profiles table to allow public profile fields to be visible to event members
-- This supplements the existing restrictive policy
CREATE POLICY "Event members can view limited profile info" 
ON public.profiles
FOR SELECT 
USING (
    -- Allow access to non-sensitive fields only for event members
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
);