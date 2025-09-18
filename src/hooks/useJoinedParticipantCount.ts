import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useJoinedParticipantCount(eventId: string | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setCount(0);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Initial fetch
    const fetchCount = async () => {
      try {
        const { data, error } = await supabase
          .from('event_members')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'joined');

        if (error) throw error;
        
        if (isMounted) {
          setCount(data?.length || 0);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching participant count:', error);
        if (isMounted) {
          setCount(0);
          setLoading(false);
        }
      }
    };

    fetchCount();

    // Set up real-time subscription
    const channel = supabase
      .channel(`event_members_count_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_members',
          filter: `event_id=eq.${eventId}`
        },
        async () => {
          // Refetch count when members change
          await fetchCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { count, loading };
}