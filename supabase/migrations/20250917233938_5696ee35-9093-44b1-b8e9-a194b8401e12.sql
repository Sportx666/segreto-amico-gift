-- Fix security vulnerabilities in chat_messages table
-- Consolidate complex, overlapping RLS policies into secure, auditable ones

-- 1. Drop all existing chat_messages policies to start clean
DROP POLICY IF EXISTS "Assignment participants can view pair messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Event members can view direct messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Event members can view event messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view event chat messages they have access to" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send direct messages to event members" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to events they are members of" ON public.chat_messages;

-- 2. Create security functions to avoid code duplication and improve auditability
CREATE OR REPLACE FUNCTION public.is_event_participant(_event_id uuid, _user_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM event_members em
    JOIN participants p ON p.id = em.participant_id
    WHERE em.event_id = _event_id 
      AND p.profile_id = _user_id
      AND em.status = 'joined'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_message_participant(_author_id uuid, _recipient_id uuid, _user_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM participants 
    WHERE profile_id = _user_id 
      AND id IN (_author_id, _recipient_id)
  );
$$;

-- 3. Create consolidated, secure SELECT policies
CREATE POLICY "chat_select_event_messages" 
ON public.chat_messages 
FOR SELECT 
TO authenticated
USING (
  channel = 'event' 
  AND public.is_event_participant(event_id, auth.uid())
);

CREATE POLICY "chat_select_pair_messages" 
ON public.chat_messages 
FOR SELECT 
TO authenticated
USING (
  channel = 'pair' 
  AND recipient_participant_id IS NOT NULL
  AND public.is_message_participant(author_participant_id, recipient_participant_id, auth.uid())
);

CREATE POLICY "chat_select_assignment_messages" 
ON public.chat_messages 
FOR SELECT 
TO authenticated
USING (
  channel = 'pair' 
  AND assignment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM assignments a
    JOIN participants pg ON pg.id = a.giver_id
    JOIN participants pr ON pr.id = a.receiver_id
    WHERE a.id = assignment_id 
      AND (pg.profile_id = auth.uid() OR pr.profile_id = auth.uid())
  )
);

-- 4. Create consolidated, secure INSERT policies
CREATE POLICY "chat_insert_event_messages" 
ON public.chat_messages 
FOR INSERT 
TO authenticated
WITH CHECK (
  channel = 'event'
  AND public.is_event_participant(event_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM participants 
    WHERE id = author_participant_id AND profile_id = auth.uid()
  )
  AND recipient_participant_id IS NULL
  AND assignment_id IS NULL
);

CREATE POLICY "chat_insert_pair_messages" 
ON public.chat_messages 
FOR INSERT 
TO authenticated
WITH CHECK (
  channel = 'pair'
  AND recipient_participant_id IS NOT NULL
  AND public.is_event_participant(event_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM participants 
    WHERE id = author_participant_id AND profile_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM event_members em
    JOIN participants p ON p.id = em.participant_id
    WHERE em.event_id = chat_messages.event_id 
      AND p.id = recipient_participant_id
      AND em.status = 'joined'
  )
);

-- 5. Add UPDATE and DELETE policies for completeness and security
CREATE POLICY "chat_update_own_messages" 
ON public.chat_messages 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM participants 
    WHERE id = author_participant_id AND profile_id = auth.uid()
  )
)
WITH CHECK (
  -- Prevent changing critical fields
  OLD.event_id = NEW.event_id
  AND OLD.channel = NEW.channel
  AND OLD.author_participant_id = NEW.author_participant_id
  AND OLD.recipient_participant_id = NEW.recipient_participant_id
  AND OLD.assignment_id = NEW.assignment_id
);

CREATE POLICY "chat_delete_own_messages" 
ON public.chat_messages 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM participants 
    WHERE id = author_participant_id AND profile_id = auth.uid()
  )
);

-- 6. Add table documentation
COMMENT ON TABLE public.chat_messages IS 'Secure chat messages with RLS - users can only access messages they are authorized to see';
COMMENT ON FUNCTION public.is_event_participant(uuid, uuid) IS 'Security function to check if user is a joined participant in an event';
COMMENT ON FUNCTION public.is_message_participant(uuid, uuid, uuid) IS 'Security function to check if user is involved in a private message';