import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatService, PrivateChat } from '@/services/chatService';

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

const getAllLastReadTimestamps = (chatIds: string[]): Record<string, string> => {
  const timestamps: Record<string, string> = {};
  for (const chatId of chatIds) {
    const ts = getLastReadTimestamp(chatId);
    if (ts) {
      timestamps[chatId] = ts;
    }
  }
  return timestamps;
};

export function useOptimizedPrivateChats(eventId: string) {
  const { user } = useAuth();
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!user || !eventId) return;
    
    setLoading(true);
    try {
      // First, get all chat IDs to build the lastRead map
      const participantId = await chatService.getParticipantId(user.id);
      if (!participantId) {
        setLoading(false);
        return;
      }

      // Quick query to get chat IDs first
      const { data: chatIds } = await supabase
        .from('private_chats')
        .select('id')
        .eq('event_id', eventId)
        .or(`anonymous_participant_id.eq.${participantId},exposed_participant_id.eq.${participantId}`);

      const lastReadTimestamps = getAllLastReadTimestamps(
        (chatIds || []).map(c => c.id)
      );

      // Fetch full chat data with batched unread counts
      const formattedChats = await chatService.fetchPrivateChats(
        user.id,
        eventId,
        lastReadTimestamps
      );

      setChats(formattedChats);
    } catch (error) {
      console.error('Error in fetchChats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  const markAsRead = useCallback((chatId: string) => {
    setLastReadTimestamp(chatId);
    setChats(prev => prev.map(c => 
      c.id === chatId ? { ...c, unreadCount: 0 } : c
    ));
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Subscribe to new private chats and messages
  useEffect(() => {
    if (!user || !eventId) return;

    const channel = supabase
      .channel(`private_chats_optimized_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_chats',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchChats()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchChats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, eventId, fetchChats]);

  return { chats, loading, refetch: fetchChats, markAsRead };
}
