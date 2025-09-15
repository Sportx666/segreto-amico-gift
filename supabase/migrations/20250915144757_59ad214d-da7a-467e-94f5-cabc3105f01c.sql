-- Fix Security Definer View issue by dropping problematic views
-- These views are owned by postgres superuser and bypass RLS policies

-- Drop views that are not actively used in the application
-- They only exist in auto-generated types and can be safely removed

DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.v_assignment_members CASCADE; 
DROP VIEW IF EXISTS public.v_exclusion_members CASCADE;

-- Note: The auto-generated types file will be updated automatically
-- These views were not being used in the application logic, only in type definitions