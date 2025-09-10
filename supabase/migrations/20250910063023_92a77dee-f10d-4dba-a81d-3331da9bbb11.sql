-- Add recipient_participant_id to chat_messages for direct messaging
ALTER TABLE public.chat_messages 
ADD COLUMN recipient_participant_id uuid,
ADD CONSTRAINT chat_messages_recipient_participant_id_fkey 
  FOREIGN KEY (recipient_participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;

-- Create index for recipient queries
CREATE INDEX idx_chat_messages_recipient_id ON public.chat_messages (recipient_participant_id) 
WHERE recipient_participant_id IS NOT NULL;

-- Update RLS policy to allow direct messaging between any event members
CREATE POLICY "Event members can view direct messages" ON public.chat_messages
  FOR SELECT USING (
    channel = 'pair' AND recipient_participant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.profile_id = auth.uid() AND (
        p.id = chat_messages.author_participant_id OR 
        p.id = chat_messages.recipient_participant_id
      )
    )
  );

-- Update insert policy to allow direct messaging
CREATE POLICY "Users can send direct messages to event members" ON public.chat_messages
  FOR INSERT WITH CHECK (
    channel = 'pair' AND recipient_participant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = chat_messages.author_participant_id
        AND p.profile_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.event_members em1
      JOIN public.participants p1 ON p1.id = em1.participant_id
      WHERE em1.event_id = chat_messages.event_id
        AND p1.profile_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.event_members em2
      JOIN public.participants p2 ON p2.id = em2.participant_id
      WHERE em2.event_id = chat_messages.event_id
        AND p2.id = chat_messages.recipient_participant_id
    )
  );