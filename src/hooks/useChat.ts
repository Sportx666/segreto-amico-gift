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
  private_chat_id?: string;
}

interface UseChatOptions {
  eventId?: string;
  channel?: 'event' | 'pair';
  privateChatId?: string;
  recipientId?: string; // Only used when creating a new chat
}

export function useChat(options: UseChatOptions) {
  const { eventId, channel = 'event', privateChatId, recipientId } = options;
  const { session } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(privateChatId);

  // Track in-flight requests to avoid race conditions
  const fetchIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    if (!eventId || !session?.access_token) return;
    if (channel === 'pair' && !privateChatId) return;

    // Abort any in-flight request
    try { controllerRef.current?.abort(); } catch {}
    const controller = new AbortController();
    controllerRef.current = controller;

    const fetchId = ++fetchIdRef.current;
    const currentOffset = isLoadMore ? offset : 0;
    
    let url = `https://eociecgrdwllggcohmko.supabase.co/functions/v1/chat-list?eventId=${eventId}&channel=${channel}&offset=${currentOffset}&limit=25`;
    
    if (channel === 'pair' && privateChatId) {
      url += `&privateChatId=${privateChatId}`;
    }

    setLoading(true);
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();

      // Ignore stale responses
      if (fetchId !== fetchIdRef.current) return;

      if (isLoadMore) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages.reverse());
      }
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.messages.length);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error fetching messages:', error);
      toast.error(t('toasts.load_messages_error'));
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [eventId, channel, session, privateChatId, offset, t]);

  const sendMessage = useCallback(async (content: string): Promise<{ success: boolean; privateChatId?: string }> => {
    if (!eventId || !session?.access_token || !content.trim()) {
      return { success: false };
    }
    
    setSending(true);
    try {
      const body: any = {
        eventId,
        channel,
        content: content.trim(),
      };

      // For pair channel, include privateChatId or recipientId
      if (channel === 'pair') {
        if (currentChatId || privateChatId) {
          body.privateChatId = currentChatId || privateChatId;
        } else if (recipientId) {
          body.recipientId = recipientId;
        }
      }

      const response = await fetch('https://eociecgrdwllggcohmko.supabase.co/functions/v1/chat-send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Add new message to the end
      setMessages(prev => [...prev, data.message]);
      
      // If a new chat was created, update the current chat ID
      if (data.privateChatId && !currentChatId) {
        setCurrentChatId(data.privateChatId);
      }
      
      return { success: true, privateChatId: data.privateChatId };
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('toasts.send_message_error'));
      return { success: false };
    } finally {
      setSending(false);
    }
  }, [eventId, channel, session, privateChatId, currentChatId, recipientId, t]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMessages(true);
    }
  };

  // Reset and refetch when key parameters change
  useEffect(() => {
    if (eventId) {
      setMessages([]);
      setOffset(0);
      setCurrentChatId(privateChatId);
      fetchMessages(false);
    }
  }, [eventId, channel, privateChatId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!eventId) return;

    const channelName = privateChatId 
      ? `chat_messages_${eventId}_pair_${privateChatId}` 
      : `chat_messages_${eventId}_${channel}`;
    
    const subscription = supabase
      .channel(channelName)
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
          
          if (channel === 'event' && newMessage.channel === 'event') {
            setMessages(prev => [...prev, newMessage]);
          } else if (channel === 'pair' && newMessage.channel === 'pair') {
            // For pair channel, only show messages from the same private chat
            const targetChatId = currentChatId || privateChatId;
            if (newMessage.private_chat_id === targetChatId) {
              setMessages(prev => [...prev, newMessage]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [eventId, channel, privateChatId, currentChatId]);

  return {
    messages,
    loading,
    sending,
    hasMore,
    sendMessage,
    loadMore,
    refetch: () => fetchMessages(false),
    currentChatId: currentChatId || privateChatId,
  };
}
