-- Create function to send assignment notifications when draw is completed
CREATE OR REPLACE FUNCTION public.notify_assignment_completion()
RETURNS TRIGGER AS $$
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
      
      -- Get receiver's display name
      SELECT pr.display_name INTO receiver_display_name
      FROM public.participants pa
      JOIN public.profiles pr ON pr.id = pa.profile_id
      WHERE pa.id = assignment_record.receiver_id;
      
      -- Insert notification for the giver
      INSERT INTO public.notifications (
        profile_id,
        type,
        title,
        body
      ) VALUES (
        giver_profile_id,
        'assignment',
        'Sorteggio completato!',
        format('Il sorteggio per "%s" è stato completato. Dovrai fare un regalo a %s!', 
               event_record.name, 
               COALESCE(receiver_display_name, 'qualcuno'))
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for draw completion notifications
DROP TRIGGER IF EXISTS trigger_notify_assignment_completion ON public.events;
CREATE TRIGGER trigger_notify_assignment_completion
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_completion();