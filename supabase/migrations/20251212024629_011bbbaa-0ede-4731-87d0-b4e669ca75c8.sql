-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "participants_select_event_members" ON public.participants;
DROP POLICY IF EXISTS "profiles_select_event_members" ON public.profiles;

-- Create a security definer function to check if user is co-member with a participant
CREATE OR REPLACE FUNCTION public.is_event_co_member(_participant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM event_members em1
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p ON p.id = em2.participant_id
    WHERE em1.participant_id = _participant_id
      AND p.profile_id = _user_id
      AND em1.status = 'joined'
      AND em2.status = 'joined'
  )
$$;

-- Create a security definer function to check if user is co-member with a profile
CREATE OR REPLACE FUNCTION public.is_profile_co_member(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM event_members em1
    JOIN participants p1 ON p1.id = em1.participant_id
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p2 ON p2.id = em2.participant_id
    WHERE p1.profile_id = _profile_id
      AND p2.profile_id = _user_id
      AND em1.status = 'joined'
      AND em2.status = 'joined'
  )
$$;

-- Recreate participants policy using the security definer function
CREATE POLICY "participants_select_event_members" ON public.participants
  FOR SELECT USING (
    (profile_id = auth.uid())
    OR public.is_event_co_member(id, auth.uid())
  );

-- Recreate profiles policy using the security definer function  
CREATE POLICY "profiles_select_event_members" ON public.profiles
  FOR SELECT USING (
    (id = auth.uid())
    OR public.is_profile_co_member(id, auth.uid())
  );