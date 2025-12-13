-- Create push_tokens table for storing device tokens
CREATE TABLE public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tokens
CREATE POLICY "push_tokens_insert" ON public.push_tokens 
FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Users can view their own tokens
CREATE POLICY "push_tokens_select" ON public.push_tokens 
FOR SELECT USING (auth.uid() = profile_id);

-- Users can delete their own tokens
CREATE POLICY "push_tokens_delete" ON public.push_tokens 
FOR DELETE USING (auth.uid() = profile_id);

-- Users can update their own tokens
CREATE POLICY "push_tokens_update" ON public.push_tokens 
FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Index for efficient lookups by profile
CREATE INDEX idx_push_tokens_profile ON public.push_tokens(profile_id);

-- Trigger to update updated_at
CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();