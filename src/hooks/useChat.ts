import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';

interface ChatMessage {
  id: string;
  content: string;
  alias_snapshot: string;
  color_snapshot: string;
  created_at: string;
  author_participant_id: string;
  channel: string;
  assignment_id?: string;
  recipient_participant_id?: string;
}

export function useChat(eventId?: string, channel: 'event' | 'pair' = 'event', recipientId?: string) {
  const { session } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
const [offset, setOffset] = useState(0);

  // Track in-flight requests to avoid race conditions and stale updates
  const fetchIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    if (!eventId || !session?.access_token) return;
    if (channel === 'pair' && !recipientId) return; // don't fetch pair messages without a recipient

    // Abort any in-flight request
    try { controllerRef.current?.abort(); } catch {}
    const controller = new AbortController();
    controllerRef.current = controller;

    const fetchId = ++fetchIdRef.current;
    const currentOffset = isLoadMore ? offset : 0;
    const url = `https://eociecgrdwllggcohmko.supabase.co/functions/v1/chat-list?eventId=${eventId}&channel=${channel}&offset=${currentOffset}&limit=25${recipientId ? `&recipientId=${recipientId}` : ''}`;

    setLoading(true);
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();

      // Critical: Ignore stale responses to prevent race conditions
      if (fetchId !== fetchIdRef.current) {
        console.log('Ignoring stale response for fetch ID', fetchId, 'current:', fetchIdRef.current);
        return;
      }

      // Additional validation: ensure response matches current request parameters
      const currentRecipient = channel === 'pair' ? recipientId : null;
      const responseForCorrectChannel = data.messages.every((msg: ChatMessage) => {
        if (channel === 'event') return msg.channel === 'event';
        if (channel === 'pair') {
          return msg.channel === 'pair' && 
            currentRecipient && 
            (msg.recipient_participant_id === currentRecipient || msg.author_participant_id === currentRecipient);
        }
        return true;
      });

      if (!responseForCorrectChannel) {
        console.log('Ignoring response with mismatched channel data');
        return;
      }

      if (isLoadMore) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages.reverse());
      }
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.messages.length);
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // ignore aborted
      console.error('Error fetching messages:', error);
      toast.error(t('toasts.load_messages_error'));
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [eventId, channel, session, recipientId, offset, t]);

  const sendMessage = useCallback(async (content: string) => {
    if (!eventId || !session?.access_token || !content.trim()) return false;
    
    setSending(true);
    try {
      const response = await fetch('https://eociecgrdwllggcohmko.supabase.co/functions/v1/chat-send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          channel,
          content: content.trim(),
          recipientId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Add new message to the end (newest)
      setMessages(prev => [...prev, data.message]);
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      console.log('Send message payload:', { eventId, channel, content: content.trim(), recipientId });
      toast.error(t('toasts.send_message_error'));
      return false;
    } finally {
      setSending(false);
    }
  }, [eventId, channel, session, recipientId, t]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMessages(true);
    }
  };

  useEffect(() => {
    if (eventId) {
      setMessages([]);
      setOffset(0);
      fetchMessages(false);
    }
  }, [eventId, channel, recipientId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!eventId) return;

    const channel_name = recipientId ? `chat_messages_${eventId}_${channel}_${recipientId}` : `chat_messages_${eventId}_${channel}`;
    
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
            // For pair channel with recipient, only show messages involving the recipient
            if (channel === 'pair' && recipientId) {
              if (newMessage.recipient_participant_id === recipientId || newMessage.author_participant_id === recipientId) {
                setMessages(prev => [...prev, newMessage]);
              }
            } else {
              setMessages(prev => [...prev, newMessage]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [eventId, channel, recipientId]);

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
