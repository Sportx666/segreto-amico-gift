-- Create anonymous_aliases table
CREATE TABLE public.anonymous_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  nickname text NOT NULL,
  changes_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anonymous_aliases_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT anonymous_aliases_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT anonymous_aliases_unique_participant_per_event UNIQUE (event_id, participant_id),
  CONSTRAINT anonymous_aliases_unique_nickname_per_event UNIQUE (event_id, nickname)
);

-- Enable RLS on anonymous_aliases
ALTER TABLE public.anonymous_aliases ENABLE ROW LEVEL SECURITY;

-- RLS policies for anonymous_aliases: event members can select, only owner can upsert
CREATE POLICY "Event members can view aliases" ON public.anonymous_aliases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      JOIN public.participants p ON p.id = em.participant_id
      WHERE em.event_id = anonymous_aliases.event_id
        AND p.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own aliases" ON public.anonymous_aliases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = anonymous_aliases.participant_id
        AND p.profile_id = auth.uid()
    )
  );

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('event', 'pair')),
  assignment_id uuid,
  author_participant_id uuid NOT NULL,
  alias_snapshot text NOT NULL,
  color_snapshot text DEFAULT '#6366f1',
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_author_participant_id_fkey FOREIGN KEY (author_participant_id) REFERENCES public.participants(id) ON DELETE CASCADE
);

-- Create indexes for chat_messages
CREATE INDEX idx_chat_messages_event_channel_created_at ON public.chat_messages (event_id, channel, created_at DESC);
CREATE INDEX idx_chat_messages_assignment_id ON public.chat_messages (assignment_id) WHERE assignment_id IS NOT NULL;

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
-- Event members can see event channel messages
CREATE POLICY "Event members can view event messages" ON public.chat_messages
  FOR SELECT USING (
    channel = 'event' AND EXISTS (
      SELECT 1 FROM public.event_members em
      JOIN public.participants p ON p.id = em.participant_id
      WHERE em.event_id = chat_messages.event_id
        AND p.profile_id = auth.uid()
    )
  );

-- Only giver and receiver can see pair messages
CREATE POLICY "Assignment participants can view pair messages" ON public.chat_messages
  FOR SELECT USING (
    channel = 'pair' AND assignment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.participants pg ON pg.id = a.giver_id
      JOIN public.participants pr ON pr.id = a.receiver_id
      WHERE a.id = chat_messages.assignment_id
        AND (pg.profile_id = auth.uid() OR pr.profile_id = auth.uid())
    )
  );

-- Users can only insert messages as themselves
CREATE POLICY "Users can insert their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = chat_messages.author_participant_id
        AND p.profile_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.event_members em
      JOIN public.participants p ON p.id = em.participant_id
      WHERE em.event_id = chat_messages.event_id
        AND p.profile_id = auth.uid()
    )
  );

-- Create RPC function to update profile display name
CREATE OR REPLACE FUNCTION public.update_profile_display_name(_profile_id uuid, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to update their own profile
  IF _profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Update the profile display name
  UPDATE public.profiles 
  SET display_name = _name 
  WHERE id = _profile_id;
  
  -- Optionally sync any copied display field in event_members if needed
  -- (Not implemented as anonymous_name seems to be for invitation purposes)
END;
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for anonymous_aliases updated_at
CREATE TRIGGER update_anonymous_aliases_updated_at
  BEFORE UPDATE ON public.anonymous_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();