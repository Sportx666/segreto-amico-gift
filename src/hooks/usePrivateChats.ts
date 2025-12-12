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
  
  // Unread message count
  unreadCount: number;
  
  lastMessageAt: string;
  createdAt: string;
}

// Track last read timestamps in localStorage
const getLastReadKey = (chatId: string) => `chat_last_read_${chatId}`;

const getLastReadTimestamp = (chatId: string): string | null => {
  try {
    return localStorage.getItem(getLastReadKey(chatId));
  } catch {
    return null;
  }
};

const setLastReadTimestamp = (chatId: string) => {
  try {
    localStorage.setItem(getLastReadKey(chatId), new Date().toISOString());
  } catch {
    // Ignore localStorage errors
  }
};

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

      // Fetch unread counts for each chat
      const formattedChats: PrivateChat[] = await Promise.all(
        (privateChats || []).map(async (chat: any) => {
          const isAnonymous = chat.anonymous_participant_id === myParticipant.id;
          const lastRead = getLastReadTimestamp(chat.id);
          
          // Count unread messages (messages after last read)
          let unreadCount = 0;
          if (lastRead) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('private_chat_id', chat.id)
              .neq('author_participant_id', myParticipant.id)
              .gt('created_at', lastRead);
            
            unreadCount = count || 0;
          } else {
            // If never read, count all messages from other participant
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('private_chat_id', chat.id)
              .neq('author_participant_id', myParticipant.id);
            
            unreadCount = count || 0;
          }
          
          return {
            id: chat.id,
            eventId: chat.event_id,
            myRole: isAnonymous ? 'anonymous' : 'exposed',
            myParticipantId: myParticipant.id,
            otherParticipantId: isAnonymous ? chat.exposed_participant_id : chat.anonymous_participant_id,
            // What I see: if I'm anonymous, I see the exposed person's real name; if I'm exposed, I see their alias
            displayName: isAnonymous ? chat.exposed_name : chat.anonymous_alias,
            unreadCount,
            lastMessageAt: chat.last_message_at,
            createdAt: chat.created_at,
          };
        })
      );

      setChats(formattedChats);
    } catch (error) {
      console.error('Error in fetchChats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  // Mark a chat as read
  const markAsRead = useCallback((chatId: string) => {
    setLastReadTimestamp(chatId);
    // Update local state immediately
    setChats(prev => prev.map(c => 
      c.id === chatId ? { ...c, unreadCount: 0 } : c
    ));
  }, []);

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

  // Subscribe to new messages to update unread counts
  useEffect(() => {
    if (!user || !eventId) return;

    const channel = supabase
      .channel(`chat_messages_unread_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Refetch to update unread counts
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, eventId, fetchChats]);

  return { chats, loading, refetch: fetchChats, markAsRead };
}
