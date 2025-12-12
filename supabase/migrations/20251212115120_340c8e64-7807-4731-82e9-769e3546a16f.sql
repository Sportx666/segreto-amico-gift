-- Add composite index for efficient unread message counting
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread 
ON chat_messages (private_chat_id, author_participant_id, created_at DESC);

-- Add index for event channel queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_event_channel 
ON chat_messages (event_id, channel, created_at DESC);

-- Create function to batch get unread counts for private chats
CREATE OR REPLACE FUNCTION get_private_chat_unread_counts(
  _participant_id uuid,
  _event_id uuid,
  _last_read_timestamps jsonb
)
RETURNS TABLE(chat_id uuid, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as chat_id,
    COUNT(cm.id)::bigint as unread_count
  FROM private_chats pc
  LEFT JOIN chat_messages cm ON cm.private_chat_id = pc.id
    AND cm.author_participant_id != _participant_id
    AND (
      _last_read_timestamps IS NULL 
      OR _last_read_timestamps->>pc.id::text IS NULL
      OR cm.created_at > (_last_read_timestamps->>pc.id::text)::timestamptz
    )
  WHERE pc.event_id = _event_id
    AND (pc.anonymous_participant_id = _participant_id OR pc.exposed_participant_id = _participant_id)
  GROUP BY pc.id;
END;
$$;