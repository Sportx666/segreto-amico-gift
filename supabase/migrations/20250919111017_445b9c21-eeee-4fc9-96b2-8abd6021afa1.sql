-- Update event_members.join_token to be a UUID foreign key to join_tokens.id
-- First, drop the existing join_token column
ALTER TABLE public.event_members DROP COLUMN IF EXISTS join_token;

-- Add the new join_token column as UUID with foreign key constraint
ALTER TABLE public.event_members 
ADD COLUMN join_token UUID REFERENCES public.join_tokens(id) ON DELETE SET NULL;