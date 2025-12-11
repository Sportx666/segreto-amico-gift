-- Create private_chats table for directional anonymous chat threads
CREATE TABLE public.private_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- The anonymous side (hidden identity to the other party)
  anonymous_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  anonymous_alias text NOT NULL,  -- What the exposed user sees (the alias)
  
  -- The exposed side (real identity visible to the anonymous side)
  exposed_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  exposed_name text NOT NULL,  -- What the anonymous user sees (real name)
  
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  
  -- Each directional chat is unique per event
  UNIQUE(event_id, anonymous_participant_id, exposed_participant_id)
);

-- Enable RLS
ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view private chats they are part of
CREATE POLICY "Users can view their private chats"
ON public.private_chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.profile_id = auth.uid()
    AND (p.id = private_chats.anonymous_participant_id OR p.id = private_chats.exposed_participant_id)
  )
);

-- Policy: Users can create private chats where they are the anonymous party
CREATE POLICY "Users can create private chats as anonymous party"
ON public.private_chats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.profile_id = auth.uid()
    AND p.id = private_chats.anonymous_participant_id
  )
);

-- Add private_chat_id column to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN private_chat_id uuid REFERENCES private_chats(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_chat_messages_private_chat_id ON public.chat_messages(private_chat_id);
CREATE INDEX idx_private_chats_event ON public.private_chats(event_id);
CREATE INDEX idx_private_chats_anonymous ON public.private_chats(anonymous_participant_id);
CREATE INDEX idx_private_chats_exposed ON public.private_chats(exposed_participant_id);

-- Add private_chat_id column to notifications for direct navigation
ALTER TABLE public.notifications 
ADD COLUMN private_chat_id uuid REFERENCES private_chats(id) ON DELETE SET NULL;

-- Update RLS for chat_messages to support private_chat_id
-- Drop existing pair policies
DROP POLICY IF EXISTS "chat_insert_pair_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_select_pair_messages" ON public.chat_messages;

-- New policy: Select pair messages by private_chat_id
CREATE POLICY "chat_select_pair_messages_v2"
ON public.chat_messages
FOR SELECT
USING (
  channel = 'pair' 
  AND private_chat_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM private_chats pc
    JOIN participants p ON (p.id = pc.anonymous_participant_id OR p.id = pc.exposed_participant_id)
    WHERE pc.id = chat_messages.private_chat_id
    AND p.profile_id = auth.uid()
  )
);

-- New policy: Insert pair messages with private_chat_id
CREATE POLICY "chat_insert_pair_messages_v2"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  channel = 'pair'
  AND private_chat_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = chat_messages.author_participant_id
    AND p.profile_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM private_chats pc
    JOIN participants p ON (p.id = pc.anonymous_participant_id OR p.id = pc.exposed_participant_id)
    WHERE pc.id = chat_messages.private_chat_id
    AND p.profile_id = auth.uid()
  )
);