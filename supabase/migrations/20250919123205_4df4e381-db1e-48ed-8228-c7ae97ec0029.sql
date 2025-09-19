-- Update token validity to 5 days (7200 minutes) instead of 7 days (10080 minutes)
CREATE OR REPLACE FUNCTION public.create_or_get_join_token(
  _event_id uuid,
  _participant_id uuid,
  _ttl_minutes int DEFAULT 7200
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