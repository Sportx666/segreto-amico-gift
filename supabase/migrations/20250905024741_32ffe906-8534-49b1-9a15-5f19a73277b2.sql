-- Update schema to support tokenized joins without accounts
-- Add join tokens table for anonymous participants
CREATE TABLE public.join_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for join_tokens
ALTER TABLE public.join_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read join tokens (needed for validation)
CREATE POLICY "Anyone can read valid join tokens" ON public.join_tokens
  FOR SELECT USING (expires_at > now() AND used_at IS NULL);

-- Only event admins can create join tokens  
CREATE POLICY "Event admins can create join tokens" ON public.join_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = join_tokens.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- Update members table to support anonymous participants
ALTER TABLE public.members 
ADD COLUMN join_token TEXT,
ADD COLUMN anonymous_email TEXT,
ADD COLUMN anonymous_name TEXT;

-- Update the members RLS policy to allow token-based access
DROP POLICY IF EXISTS "Event admins can manage members" ON public.members;

-- New policy: Event admins OR token holders can view members
CREATE POLICY "Event members can view members" ON public.members
  FOR SELECT USING (
    -- Event admin can see all members
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = members.event_id 
      AND events.admin_id = auth.uid()
    )
    OR
    -- Token holder can see members if they're part of event
    EXISTS (
      SELECT 1 FROM public.join_tokens jt
      WHERE jt.event_id = members.event_id
      AND jt.token = members.join_token
      AND jt.expires_at > now()
    )
  );

-- Event admins can insert/update members
CREATE POLICY "Event admins can manage members" ON public.members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = members.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- Anonymous users can insert themselves via token
CREATE POLICY "Token holders can join as members" ON public.members
  FOR INSERT WITH CHECK (
    join_token IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.join_tokens jt
      WHERE jt.token = join_token
      AND jt.event_id = members.event_id
      AND jt.expires_at > now()
      AND jt.used_at IS NULL
    )
  );

-- Function to generate unique join codes for events
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure join tokens
CREATE OR REPLACE FUNCTION public.generate_join_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;