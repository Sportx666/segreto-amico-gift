-- Update token validity to 5 days (7200 minutes) instead of 7 days (10080 minutes)
ALTER FUNCTION public.create_or_get_join_token(_event_id uuid, _participant_id uuid, _ttl_minutes int)
SET DEFAULTS _ttl_minutes = 7200;