-- Fix profiles table RLS policies to prevent sensitive data exposure

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Event members can view limited profile info of other members" ON public.profiles;
DROP POLICY IF EXISTS "Event members can view public profile fields only" ON public.profiles;

-- Create restrictive policies that only allow:
-- 1. Users to see their own full profile
-- 2. No direct access to other users' profiles (must use get_event_member_profile function)

-- Users can only view their own profile directly
CREATE POLICY "Users can view only their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Keep existing update/insert policies as they are already secure
-- (They already restrict to auth.uid() which is correct)