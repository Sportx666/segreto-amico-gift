-- Add display_name column to event_members if it doesn't exist
ALTER TABLE public.event_members 
ADD COLUMN IF NOT EXISTS display_name text;

-- Create function to list event members safely
CREATE OR REPLACE FUNCTION public.list_event_members(_event_id uuid)
RETURNS TABLE (
  participant_id uuid,
  event_display_name text,
  anonymous_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller is in this event (or is admin)
  IF NOT EXISTS (
    SELECT 1
    FROM event_members em
    JOIN participants p ON p.id = em.participant_id
    WHERE em.event_id = _event_id
      AND (is_event_admin(_event_id, auth.uid()) OR p.profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not a member of this event';
  END IF;

  RETURN QUERY
    SELECT
      em.participant_id,
      COALESCE(em.display_name, prof.display_name, 'Anonimo') AS event_display_name,
      em.anonymous_name
    FROM event_members em
    JOIN participants pa ON pa.id = em.participant_id
    LEFT JOIN profiles prof ON prof.id = pa.profile_id
    WHERE em.event_id = _event_id
      AND em.status = 'joined';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.list_event_members(uuid) TO authenticated;