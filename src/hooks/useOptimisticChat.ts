import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { chatService, ChatMessage } from '@/services/chatService';

interface UseOptimisticChatOptions {
  eventId?: string;
  channel?: 'event' | 'pair';
  privateChatId?: string;
  recipientId?: string;
}

export function useOptimisticChat(options: UseOptimisticChatOptions) {
  const { eventId, channel = 'event', privateChatId, recipientId } = options;
  const { session, user } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(privateChatId);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myAlias, setMyAlias] = useState<string>('');

  const fetchIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  // Fetch participant ID and alias on mount
  useEffect(() => {
    if (!user?.id || !eventId) return;

    const fetchUserInfo = async () => {
      const [participantId, aliasResult, profileResult] = await Promise.all([
        chatService.getParticipantId(user.id),
        supabase
          .from('anonymous_aliases')
          .select('nickname')
          .eq('event_id', eventId)
          .eq('participant_id', (await chatService.getParticipantId(user.id)) || '')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single(),
      ]);

      setMyParticipantId(participantId);
      setMyAlias(aliasResult.data?.nickname || profileResult.data?.display_name || 'Anonimo');
    };

    fetchUserInfo();
  }, [user?.id, eventId]);

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    if (!eventId || !session?.access_token) return;
    
    const isPairChannelWithoutChat = channel === 'pair' && !privateChatId && !recipientId;
    if (isPairChannelWithoutChat) return;

    const isPendingChat = channel === 'pair' && recipientId && !privateChatId;
    if (isPendingChat) {
      setMessages([]);
      setHasMore(false);
      setOffset(0);
      setLoading(false);
      return;
    }

    try { controllerRef.current?.abort(); } catch {}
    const controller = new AbortController();
    controllerRef.current = controller;

    const fetchId = ++fetchIdRef.current;
    const currentOffset = isLoadMore ? offset : 0;
    
    setLoading(true);
    try {
      const data = await chatService.fetchMessages(
        eventId,
        channel,
        session.access_token,
        { privateChatId, offset: currentOffset, limit: 25 }
      );

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
  }, [eventId, channel, session, privateChatId, recipientId, offset, t]);

  const sendMessage = useCallback(async (content: string): Promise<{ success: boolean; privateChatId?: string }> => {
    if (!eventId || !session?.access_token || !content.trim() || !myParticipantId) {
      return { success: false };
    }

    // Create optimistic message
    const optimisticMessage = chatService.createOptimisticMessage(
      content.trim(),
      myParticipantId,
      channel,
      channel === 'pair' ? myAlias : myAlias,
      currentChatId || privateChatId
    );

    // Add to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setSending(true);

    try {
      const data = await chatService.sendMessage(
        eventId,
        channel,
        content,
        session.access_token,
        { privateChatId: currentChatId || privateChatId, recipientId }
      );

      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? { ...data.message, pending: false } : msg
      ));

      if (data.privateChatId && !currentChatId) {
        setCurrentChatId(data.privateChatId);
      }

      return { success: true, privateChatId: data.privateChatId };
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? { ...msg, pending: false, failed: true } : msg
      ));
      toast.error(t('toasts.send_message_error'));
      return { success: false };
    } finally {
      setSending(false);
    }
  }, [eventId, channel, session, privateChatId, currentChatId, recipientId, myParticipantId, myAlias, t]);

  const retryMessage = useCallback(async (failedMessage: ChatMessage) => {
    // Remove failed message and resend
    setMessages(prev => prev.filter(msg => msg.id !== failedMessage.id));
    await sendMessage(failedMessage.content);
  }, [sendMessage]);

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
      setCurrentChatId(recipientId && !privateChatId ? undefined : privateChatId);
      fetchMessages(false);
    }
  }, [eventId, channel, privateChatId, recipientId]);

  // Real-time subscription with specific filter
  useEffect(() => {
    if (!eventId) return;

    const channelName = privateChatId 
      ? `chat_messages_${eventId}_pair_${privateChatId}` 
      : `chat_messages_${eventId}_${channel}`;
    
    // Build more specific filter
    let filter = `event_id=eq.${eventId}`;
    if (channel === 'pair' && (currentChatId || privateChatId)) {
      filter += `,private_chat_id=eq.${currentChatId || privateChatId}`;
    }
    
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Avoid duplicates (from optimistic updates or own messages)
          setMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m.id === newMessage.id)) return prev;
            // Check if it's replacing an optimistic message
            if (prev.some(m => m.pending && m.content === newMessage.content)) return prev;
            
            if (channel === 'event' && newMessage.channel === 'event') {
              return [...prev, newMessage];
            } else if (channel === 'pair' && newMessage.channel === 'pair') {
              const targetChatId = currentChatId || privateChatId;
              if (newMessage.private_chat_id === targetChatId) {
                return [...prev, newMessage];
              }
            }
            return prev;
          });
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
    retryMessage,
    loadMore,
    refetch: () => fetchMessages(false),
    currentChatId: currentChatId || privateChatId,
  };
}
