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
 * Hook to get all event members (invited, joined, etc.) with real-time updates
 */
export function useEventMembers(eventId: string | undefined) {
  const [members, setMembers] = useState<EventMemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Initial fetch
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('event_members')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (isMounted) {
          setMembers(data || []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching event members:', error);
        if (isMounted) {
          setMembers([]);
          setLoading(false);
        }
      }
    };

    fetchMembers();

    // Set up real-time subscription
    const channel = supabase
      .channel(`event_members_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_members',
          filter: `event_id=eq.${eventId}`
        },
        async () => {
          // Refetch members when they change
          await fetchMembers();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { members, loading };
}