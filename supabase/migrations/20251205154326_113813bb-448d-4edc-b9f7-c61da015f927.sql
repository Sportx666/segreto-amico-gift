-- Add auto_draw_enabled column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS auto_draw_enabled boolean DEFAULT false;