import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  content: string;
  alias_snapshot: string;
  color_snapshot: string;
  created_at: string;
  author_participant_id: string;
  channel: string;
  assignment_id?: string;
}

export function useChat(eventId?: string, channel: 'event' | 'pair' = 'event') {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    if (!eventId || !session?.access_token) return;
    
    setLoading(true);
    try {
      const currentOffset = isLoadMore ? offset : 0;
      
      const response = await fetch(`/api/chat/list?eventId=${eventId}&channel=${channel}&offset=${currentOffset}&limit=25`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      
      if (isLoadMore) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages.reverse()); // API returns newest first, we want oldest first for display
      }
      
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.messages.length);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Errore nel caricamento dei messaggi');
    } finally {
      setLoading(false);
    }
  }, [eventId, channel, session, offset]);

  const sendMessage = async (content: string) => {
    if (!eventId || !session?.access_token || !content.trim()) return false;
    
    setSending(true);
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          channel,
          content: content.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Add new message to the end (newest)
      setMessages(prev => [...prev, data.message]);
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Errore nell\'invio del messaggio');
      return false;
    } finally {
      setSending(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMessages(true);
    }
  };

  useEffect(() => {
    if (eventId) {
      setOffset(0);
      fetchMessages(false);
    }
  }, [eventId, channel]);

  // Set up real-time subscription
  useEffect(() => {
    if (!eventId) return;

    const channel_name = `chat_messages_${eventId}_${channel}`;
    
    const subscription = supabase
      .channel(channel_name)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          if (newMessage.channel === channel) {
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [eventId, channel]);

  return {
    messages,
    loading,
    sending,
    hasMore,
    sendMessage,
    loadMore,
    refetch: () => fetchMessages(false)
  };
}