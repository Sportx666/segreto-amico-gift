-- Issue 1: Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Issue 2: Add event_id column to notifications for proper navigation
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Issue 2: Add recipient_participant_id for DM notification linking
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS recipient_participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL;

-- Create index for faster notification queries by event
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON public.notifications(event_id);

-- Update notify_assignment_completion trigger to include event_id
CREATE OR REPLACE FUNCTION public.notify_assignment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  event_record RECORD;
  assignment_record RECORD;
  giver_profile_id uuid;
  receiver_display_name text;
BEGIN
  -- Only proceed if draw_status changed to 'completed'
  IF OLD.draw_status != 'completed' AND NEW.draw_status = 'completed' then
    
    -- Get event details
    SELECT name INTO event_record FROM public.events WHERE id = NEW.id;
    
    -- Get all assignments for this event and notify givers
    FOR assignment_record IN 
      SELECT a.giver_id, a.receiver_id, a.event_id
      FROM public.assignments a
      WHERE a.event_id = NEW.id
    LOOP
      -- Get giver's profile_id
      SELECT p.profile_id INTO giver_profile_id
      FROM public.participants p
      WHERE p.id = assignment_record.giver_id;
      
      -- Only proceed if giver profile exists AND the profile exists in auth.users
      IF giver_profile_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id = giver_profile_id) THEN
        -- Get receiver's display name
        SELECT pr.display_name INTO receiver_display_name
        FROM public.participants pa
        JOIN public.profiles pr ON pr.id = pa.profile_id
        WHERE pa.id = assignment_record.receiver_id;
        
        -- Insert notification for the giver with event_id (idempotent - only if not exists)
        INSERT INTO public.notifications (
          profile_id,
          type,
          title,
          body,
          event_id
        )
        SELECT 
          giver_profile_id,
          'assignment',
          'Sorteggio completato!',
          format('Il sorteggio per "%s" è stato completato. Dovrai fare un regalo a %s!', 
                 event_record.name, 
                 COALESCE(receiver_display_name, 'qualcuno')),
          NEW.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications 
          WHERE profile_id = giver_profile_id 
            AND type = 'assignment' 
            AND event_id = NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;