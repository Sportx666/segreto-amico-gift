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

      // Check if first_reveal_pending is true for this user's assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('first_reveal_pending')
        .eq('event_id', eventId)
        .eq('giver_id', participantId)
        .maybeSingle();

      if (assignmentError) {
        console.error('Error checking assignment reveal status:', assignmentError);
        return;
      }

      // Show animation if first_reveal_pending is true
      if (assignmentData && assignmentData.first_reveal_pending) {
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

      // Set first_reveal_pending to false for user's assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({ first_reveal_pending: false })
        .eq('event_id', eventId)
        .eq('giver_id', participantId);

      if (assignmentError) {
        console.error('Error updating assignment reveal status:', assignmentError);
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