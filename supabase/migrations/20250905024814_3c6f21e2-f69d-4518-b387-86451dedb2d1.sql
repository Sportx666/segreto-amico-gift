-- Update schema to support tokenized joins without accounts
-- Add join tokens table for anonymous participants
CREATE TABLE public.join_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id),
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
      SELECT 1 FROM public.events e
      JOIN public.participants p ON p.profile_id = auth.uid()
      JOIN public.event_members em ON em.participant_id = p.id
      WHERE e.id = join_tokens.event_id 
      AND em.event_id = e.id
      AND em.role = 'admin'
    )
  );

-- Update event_members table to support anonymous participants with join tokens
ALTER TABLE public.event_members 
ADD COLUMN join_token TEXT,
ADD COLUMN anonymous_email TEXT,
ADD COLUMN anonymous_name TEXT;

-- Update participants table to allow anonymous participants
ALTER TABLE public.participants 
ALTER COLUMN profile_id DROP NOT NULL;

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