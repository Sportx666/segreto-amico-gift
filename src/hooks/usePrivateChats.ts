import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface PrivateChat {
  id: string;
  eventId: string;
  
  // From current user's perspective
  myRole: 'anonymous' | 'exposed';
  myParticipantId: string;
  otherParticipantId: string;
  
  // What the current user sees as the display name for the other participant
  displayName: string;
  
  lastMessageAt: string;
  createdAt: string;
}

export function usePrivateChats(eventId: string) {
  const { user } = useAuth();
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!user || !eventId) return;
    
    setLoading(true);
    try {
      // Get current user's participant ID for this event
      const { data: myParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!myParticipant) {
        setLoading(false);
        return;
      }

      // Fetch all private chats where user is either anonymous or exposed
      const { data: privateChats, error } = await supabase
        .from('private_chats')
        .select('*')
        .eq('event_id', eventId)
        .or(`anonymous_participant_id.eq.${myParticipant.id},exposed_participant_id.eq.${myParticipant.id}`)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching private chats:', error);
        setLoading(false);
        return;
      }

      // Transform to PrivateChat format
      const formattedChats: PrivateChat[] = (privateChats || []).map((chat: any) => {
        const isAnonymous = chat.anonymous_participant_id === myParticipant.id;
        
        return {
          id: chat.id,
          eventId: chat.event_id,
          myRole: isAnonymous ? 'anonymous' : 'exposed',
          myParticipantId: myParticipant.id,
          otherParticipantId: isAnonymous ? chat.exposed_participant_id : chat.anonymous_participant_id,
          // What I see: if I'm anonymous, I see the exposed person's real name; if I'm exposed, I see their alias
          displayName: isAnonymous ? chat.exposed_name : chat.anonymous_alias,
          lastMessageAt: chat.last_message_at,
          createdAt: chat.created_at,
        };
      });

      setChats(formattedChats);
    } catch (error) {
      console.error('Error in fetchChats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Subscribe to new private chats
  useEffect(() => {
    if (!user || !eventId) return;

    const channel = supabase
      .channel(`private_chats_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_chats',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Refetch when any private chat changes
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, eventId, fetchChats]);

  return { chats, loading, refetch: fetchChats };
}
