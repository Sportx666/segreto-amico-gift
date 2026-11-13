import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { chatService, type PrivateChat } from '@/services/chatService';

export type { PrivateChat };

// Track last read timestamps in localStorage
const LAST_READ_PREFIX = 'chat_last_read_';

const getAllLastRead = (): Record<string, string> => {
  const result: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LAST_READ_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) result[key.slice(LAST_READ_PREFIX.length)] = value;
      }
    }
  } catch {
    // Storage unavailable (private mode etc.): treat everything as unread
  }
  return result;
};

const setLastReadTimestamp = (chatId: string) => {
  try {
    localStorage.setItem(`${LAST_READ_PREFIX}${chatId}`, new Date().toISOString());
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
      setChats(await chatService.fetchPrivateChats(eventId, getAllLastRead()));
    } catch (error) {
      console.error('Error in fetchChats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  const markAsRead = useCallback((chatId: string) => {
    setLastReadTimestamp(chatId);
    setChats(prev => prev.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // New messages (including the first message of a new chat) refresh the list
  // and unread counts. private_chats itself is not readable by clients.
  useEffect(() => {
    if (!user || !eventId) return;

    const channel = supabase
      .channel(`chat_messages_unread_${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        () => fetchChats(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, eventId, fetchChats]);

  return { chats, loading, refetch: fetchChats, markAsRead };
}
