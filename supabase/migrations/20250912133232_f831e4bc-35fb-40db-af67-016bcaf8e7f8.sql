-- Add draw_date column to events table
ALTER TABLE public.events 
ADD COLUMN draw_date date;

-- Add first_reveal_pending column to assignments table
ALTER TABLE public.assignments 
ADD COLUMN first_reveal_pending boolean DEFAULT true;