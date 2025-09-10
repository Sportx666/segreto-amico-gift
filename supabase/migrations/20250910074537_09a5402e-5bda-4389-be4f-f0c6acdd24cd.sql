-- Create chat_messages table with proper structure
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('event', 'pair')),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  recipient_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  author_participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  alias_snapshot TEXT NOT NULL,
  color_snapshot TEXT NOT NULL DEFAULT '#6366f1',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat messages
-- Users can view messages in events they are members of
CREATE POLICY "Users can view event chat messages they have access to" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.event_id = chat_messages.event_id 
    AND em.participant_id IN (
      SELECT id FROM public.participants 
      WHERE profile_id = auth.uid()
    )
    AND em.status = 'joined'
  )
);

-- Users can insert messages into events they are members of
CREATE POLICY "Users can send messages to events they are members of" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.event_id = chat_messages.event_id 
    AND em.participant_id = chat_messages.author_participant_id
    AND em.participant_id IN (
      SELECT id FROM public.participants 
      WHERE profile_id = auth.uid()
    )
    AND em.status = 'joined'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_event_channel ON public.chat_messages(event_id, channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_author ON public.chat_messages(author_participant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON public.chat_messages(recipient_participant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_messages_updated_at();