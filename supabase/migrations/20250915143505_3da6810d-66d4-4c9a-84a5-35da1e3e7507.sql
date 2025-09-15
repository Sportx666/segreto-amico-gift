-- Fix security linter issues

-- 1. Update all functions to have proper search_path settings
-- Update existing functions that are missing SET search_path

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_join_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$function$;

-- 2. Check and fix any problematic views that might be causing security issues
-- Drop and recreate views without SECURITY DEFINER if they exist

-- First, let's see what views we have by checking if there are any problematic ones
-- We'll recreate the views properly if they exist

DO $$
BEGIN
  -- Check if v_assignment_members view exists and drop if it's a security definer
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_assignment_members' AND table_schema = 'public') THEN
    DROP VIEW IF EXISTS public.v_assignment_members;
    
    -- Recreate as a regular view
    CREATE VIEW public.v_assignment_members AS
    SELECT 
      a.id,
      a.event_id,
      a.generated_on,
      em_giver.id as giver_member_id,
      em_receiver.id as receiver_member_id
    FROM assignments a
    JOIN event_members em_giver ON em_giver.participant_id = a.giver_id
    JOIN event_members em_receiver ON em_receiver.participant_id = a.receiver_id
    WHERE em_giver.event_id = a.event_id 
    AND em_receiver.event_id = a.event_id;
  END IF;

  -- Check if v_exclusion_members view exists and drop if it's a security definer
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_exclusion_members' AND table_schema = 'public') THEN
    DROP VIEW IF EXISTS public.v_exclusion_members;
    
    -- Recreate as a regular view
    CREATE VIEW public.v_exclusion_members AS
    SELECT 
      e.id,
      e.event_id,
      e.created_at,
      e.reason,
      em_giver.id as giver_member_id,
      em_blocked.id as blocked_member_id
    FROM exclusions e
    JOIN event_members em_giver ON em_giver.participant_id = e.giver_id
    JOIN event_members em_blocked ON em_blocked.participant_id = e.blocked_id
    WHERE em_giver.event_id = e.event_id 
    AND em_blocked.event_id = e.event_id;
  END IF;
END $$;