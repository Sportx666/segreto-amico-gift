import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateParticipantId } from '@/lib/participants';

interface RevealAnimationOptions {
  eventId: string;
  onComplete?: () => void;
}

export function useRevealAnimation({ eventId, onComplete }: RevealAnimationOptions) {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    checkRevealStatus();
  }, [eventId, user]);

  const checkRevealStatus = async () => {
    if (!user || !eventId) return;

    try {
      // Get participant ID
      const participantId = await getOrCreateParticipantId(user.id);

      // Check if reveal has been shown for this user and event
      const { data: memberData, error } = await supabase
        .from('event_members')
        .select('reveal_shown')
        .eq('event_id', eventId)
        .eq('participant_id', participantId)
        .maybeSingle();

      if (error) {
        console.error('Error checking reveal status:', error);
        return;
      }

      // Show animation if not yet shown
      if (memberData && !memberData.reveal_shown) {
        setShouldShow(true);
      }
    } catch (error) {
      console.error('Error in checkRevealStatus:', error);
    }
  };

  const startAnimation = async () => {
    if (!user || !eventId || isPlaying) return;

    setIsPlaying(true);

    try {
      // Mark reveal as shown in database
      const participantId = await getOrCreateParticipantId(user.id);
      
      const { error } = await supabase
        .from('event_members')
        .update({ reveal_shown: true })
        .eq('event_id', eventId)
        .eq('participant_id', participantId);

      if (error) {
        console.error('Error updating reveal status:', error);
      }

      // Animation duration - can be customized
      setTimeout(() => {
        setIsPlaying(false);
        setHasCompleted(true);
        setShouldShow(false);
        onComplete?.();
      }, 3000); // 3 second animation
      
    } catch (error) {
      console.error('Error starting reveal animation:', error);
      setIsPlaying(false);
    }
  };

  return {
    shouldShow,
    isPlaying,
    hasCompleted,
    startAnimation,
  };
}