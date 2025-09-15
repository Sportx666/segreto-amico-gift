-- Fix remaining security issues

-- 1. Fix the function that's missing search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. The public_profiles view exposes all profile data without RLS restrictions
-- This is a security risk, so let's drop it
DROP VIEW IF EXISTS public.public_profiles;

-- 3. Create a safer public profiles view that only shows non-sensitive data
CREATE VIEW public.public_profiles AS
SELECT 
    id,
    display_name,
    avatar_url,
    family_group,
    created_at
FROM profiles
WHERE id = auth.uid(); -- Only show user's own profile

-- 4. Add RLS policy to the public_profiles view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- 5. Grant appropriate permissions
GRANT SELECT ON public.public_profiles TO authenticated;