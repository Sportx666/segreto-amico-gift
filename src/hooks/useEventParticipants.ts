import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EventMemberData {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
  event_id: string;
  display_name?: string | null;
  created_at: string;
  join_token?: string | null;
}

/**
 * Hook to get only joined event participants with real-time updates
 */
export function useEventParticipants(eventId: string | undefined) {
  const [participants, setParticipants] = useState<EventMemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Initial fetch
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('event_members')
          .select('*')
          .eq('event_id', eventId)
          .eq('status', 'joined')
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (isMounted) {
          setParticipants(data || []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching event participants:', error);
        if (isMounted) {
          setParticipants([]);
          setLoading(false);
        }
      }
    };

    fetchParticipants();

    // Set up real-time subscription for event_members changes
    const channel = supabase
      .channel(`event_participants_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_members',
          filter: `event_id=eq.${eventId}`
        },
        async () => {
          // Refetch participants when members change
          await fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { participants, loading };
}