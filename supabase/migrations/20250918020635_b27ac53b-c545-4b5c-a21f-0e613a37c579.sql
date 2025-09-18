-- Security Enhancement: Remove sensitive duplicate data and improve profile security

-- 1. Remove email field from profiles since it's already in auth.users
-- This eliminates duplicate storage of sensitive email data
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 2. Enhance the get_event_member_profile function with better validation
CREATE OR REPLACE FUNCTION public.get_event_member_profile(member_profile_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text, family_group text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Enhanced validation: Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return profile data only if user has proper access
  RETURN QUERY
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
    -- Or they are event members together (enhanced check)
    EXISTS (
      SELECT 1 
      FROM event_members em1
      JOIN participants p1 ON p1.id = em1.participant_id
      JOIN event_members em2 ON em2.event_id = em1.event_id
      JOIN participants p2 ON p2.id = em2.participant_id
      WHERE p1.profile_id = auth.uid() 
      AND p2.profile_id = member_profile_id
      AND em1.status = 'joined'::text
      AND em2.status = 'joined'::text
      -- Additional security: Only active events  
      AND EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = em1.event_id 
        AND e.draw_status IN ('pending', 'completed')
      )
    )
  );
END;
$$;

-- 3. Add function to safely get user's own profile data
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE(
  id uuid, 
  display_name text, 
  avatar_url text, 
  family_group text,
  address text,
  city text,
  postal_code text,
  country text,
  phone text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.family_group,
    p.address,
    p.city,
    p.postal_code,
    p.country,
    p.phone
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- 4. Create a function to get user email from auth safely
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;