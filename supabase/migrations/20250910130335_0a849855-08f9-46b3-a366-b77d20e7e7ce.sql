-- RPC function to create or get join token
CREATE OR REPLACE FUNCTION public.create_or_get_join_token(
  _event_id uuid,
  _participant_id uuid,
  _ttl_minutes int DEFAULT 10080
)
RETURNS TABLE (token text, url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_token text;
  new_token text;
  base_url text;
  join_url text;
BEGIN
  -- Validate user is admin of the event
  IF NOT EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = _event_id AND e.admin_profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not event admin';
  END IF;

  -- Look for active unused token
  SELECT jt.token INTO existing_token
  FROM join_tokens jt
  WHERE jt.event_id = _event_id 
    AND jt.participant_id = _participant_id
    AND jt.expires_at > NOW()
    AND jt.used_at IS NULL
  ORDER BY jt.created_at DESC
  LIMIT 1;

  IF existing_token IS NOT NULL THEN
    -- Return existing token
    base_url := current_setting('app.base_url', true);
    IF base_url IS NULL OR base_url = '' THEN
      base_url := 'https://amicosegreto.lovable.app';
    END IF;
    join_url := base_url || '/join/' || existing_token;
    
    RETURN QUERY SELECT existing_token, join_url;
    RETURN;
  END IF;

  -- Create new token
  new_token := generate_join_token();
  
  INSERT INTO join_tokens (token, event_id, participant_id, expires_at)
  VALUES (
    new_token,
    _event_id,
    _participant_id,
    NOW() + (_ttl_minutes || ' minutes')::INTERVAL
  );

  -- Build URL
  base_url := current_setting('app.base_url', true);
  IF base_url IS NULL OR base_url = '' THEN
    base_url := 'https://amicosegreto.lovable.app';
  END IF;
  join_url := base_url || '/join/' || new_token;

  RETURN QUERY SELECT new_token, join_url;
END;
$$;

-- RPC function to safely remove unjoined participant
CREATE OR REPLACE FUNCTION public.remove_unjoined_participant(
  _event_id uuid,
  _participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_record RECORD;
  other_memberships_count int;
  removed_tokens int := 0;
  removed_participant boolean := false;
BEGIN
  -- Validate user is admin of the event
  IF NOT EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = _event_id AND e.admin_profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not event admin';
  END IF;

  -- Get the event member record and validate it's unjoined
  SELECT em.*, p.profile_id INTO member_record
  FROM event_members em
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id AND em.participant_id = _participant_id;

  IF member_record IS NULL THEN
    RAISE EXCEPTION 'Event member not found';
  END IF;

  -- Check if participant is unjoined (profile_id IS NULL OR status IN ('invited','pending'))
  IF member_record.profile_id IS NOT NULL AND member_record.status NOT IN ('invited', 'pending') THEN
    RAISE EXCEPTION 'Cannot remove joined participant';
  END IF;

  -- Delete join tokens for this event/participant
  DELETE FROM join_tokens 
  WHERE event_id = _event_id AND participant_id = _participant_id;
  GET DIAGNOSTICS removed_tokens = ROW_COUNT;

  -- Delete event_members row
  DELETE FROM event_members 
  WHERE event_id = _event_id AND participant_id = _participant_id;

  -- Check if participant has other event memberships
  SELECT COUNT(*) INTO other_memberships_count
  FROM event_members em
  WHERE em.participant_id = _participant_id;

  -- If no other memberships, delete the participant
  IF other_memberships_count = 0 THEN
    DELETE FROM participants WHERE id = _participant_id;
    removed_participant := true;
  END IF;

  RETURN jsonb_build_object(
    'removed_tokens', removed_tokens,
    'removed_event_member', true,
    'removed_participant', removed_participant
  );
END;
$$;