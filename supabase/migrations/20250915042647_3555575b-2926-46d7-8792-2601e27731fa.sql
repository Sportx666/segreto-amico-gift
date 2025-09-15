-- Create secure RPC function to reset event draw
CREATE OR REPLACE FUNCTION public.reset_event_draw(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure the caller is the event admin
  IF NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = _event_id AND e.admin_profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not event admin';
  END IF;

  -- Remove existing assignments for the event
  DELETE FROM assignments WHERE event_id = _event_id;

  -- Reset event draw status
  UPDATE events
  SET draw_status = 'pending'
  WHERE id = _event_id;
END;
$function$;