-- Create private_chat_names table for storing per-user display names in private chats
CREATE TABLE public.private_chat_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  participant_a_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  participant_b_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  name_for_a text NOT NULL,  -- What A sees for B
  name_for_b text NOT NULL,  -- What B sees for A
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, participant_a_id, participant_b_id)
);

-- Enable RLS
ALTER TABLE public.private_chat_names ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_private_chat_names_event ON public.private_chat_names(event_id);
CREATE INDEX idx_private_chat_names_participants ON public.private_chat_names(participant_a_id, participant_b_id);

-- RLS policy: Participants can read their own chat names
CREATE POLICY "Participants can read their own chat names"
ON public.private_chat_names
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.profile_id = auth.uid()
    AND (p.id = participant_a_id OR p.id = participant_b_id)
  )
);

-- RLS policy: Service role can insert (for edge functions)
CREATE POLICY "Service role can insert chat names"
ON public.private_chat_names
FOR INSERT
WITH CHECK (true);