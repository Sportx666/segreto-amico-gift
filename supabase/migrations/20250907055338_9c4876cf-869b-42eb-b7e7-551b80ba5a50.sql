-- Add previous_event_id column to events table for anti-recurrence tracking
ALTER TABLE public.events 
ADD COLUMN previous_event_id UUID REFERENCES public.events(id);