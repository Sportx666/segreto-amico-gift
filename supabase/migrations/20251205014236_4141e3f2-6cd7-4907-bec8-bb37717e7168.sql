-- Create function to transfer event admin role to another member
CREATE OR REPLACE FUNCTION public.transfer_event_admin(
  _event_id uuid, 
  _new_admin_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admin_profile_id uuid;
  new_admin_profile_id uuid;
  old_admin_participant_id uuid;
BEGIN
  -- Get current admin profile_id and validate caller is admin
  SELECT admin_profile_id INTO current_admin_profile_id
  FROM events
  WHERE id = _event_id;
  
  IF current_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  
  IF current_admin_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: not event admin';
  END IF;
  
  -- Validate new admin is a joined member and get their profile_id
  SELECT p.profile_id INTO new_admin_profile_id
  FROM event_members em
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id 
    AND em.participant_id = _new_admin_participant_id
    AND em.status = 'joined'
    AND p.profile_id IS NOT NULL;
  
  IF new_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'New admin must be a joined member with a linked profile';
  END IF;
  
  -- Cannot transfer to yourself
  IF new_admin_profile_id = current_admin_profile_id THEN
    RAISE EXCEPTION 'Cannot transfer admin to yourself';
  END IF;
  
  -- Get old admin's participant_id
  SELECT em.participant_id INTO old_admin_participant_id
  FROM event_members em
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id AND p.profile_id = current_admin_profile_id;
  
  -- Update events table with new admin
  UPDATE events 
  SET admin_profile_id = new_admin_profile_id
  WHERE id = _event_id;
  
  -- Update old admin's role to 'member'
  UPDATE event_members 
  SET role = 'member'
  WHERE event_id = _event_id AND participant_id = old_admin_participant_id;
  
  -- Update new admin's role to 'admin'
  UPDATE event_members 
  SET role = 'admin'
  WHERE event_id = _event_id AND participant_id = _new_admin_participant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_admin_profile_id', current_admin_profile_id,
    'new_admin_profile_id', new_admin_profile_id
  );
END;
$$;