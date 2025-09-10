import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EventMember {
  participant_id: string;
  event_display_name: string;
  anonymous_name: string | null;
}

export function useEventMembers(eventId?: string) {
  const [members, setMembers] = useState<EventMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.rpc('list_event_members', {
          _event_id: eventId
        });

        if (error) throw error;
        setMembers(data || []);
      } catch (err) {
        console.error('Error fetching event members:', err);
        setError(err as Error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [eventId]);

  const getCurrentUserParticipantId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      return participant?.id || null;
    } catch (error) {
      console.error('Error getting user participant ID:', error);
      return null;
    }
  };

  return {
    members,
    loading,
    error,
    getCurrentUserParticipantId
  };
}