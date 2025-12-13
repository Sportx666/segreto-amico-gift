import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface DMContact {
  participantId: string;
  displayName: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useDMConversations(eventId: string) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<DMContact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
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

      // Fetch all pair messages where user is author or recipient
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('author_participant_id, recipient_participant_id, alias_snapshot, created_at')
        .eq('event_id', eventId)
        .eq('channel', 'pair')
        .or(`author_participant_id.eq.${myParticipant.id},recipient_participant_id.eq.${myParticipant.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching DM conversations:', error);
        setLoading(false);
        return;
      }

      // Fetch private_chats for proper display names
      const { data: privateChats } = await supabase
        .from('private_chats')
        .select('anonymous_participant_id, exposed_participant_id, anonymous_alias, exposed_name')
        .eq('event_id', eventId)
        .or(`anonymous_participant_id.eq.${myParticipant.id},exposed_participant_id.eq.${myParticipant.id}`);

      // Create a map of participant ID -> display name for current user
      const nameMap = new Map<string, string>();
      for (const chat of privateChats || []) {
        if (chat.anonymous_participant_id === myParticipant.id) {
          // I am anonymous, I see the exposed person's name
          nameMap.set(chat.exposed_participant_id, chat.exposed_name);
        } else {
          // I am exposed, I see the anonymous person's alias
          nameMap.set(chat.anonymous_participant_id, chat.anonymous_alias);
        }
      }

      // Group by contact (the other participant)
      const contactMap = new Map<string, DMContact>();
      
      for (const msg of messages || []) {
        const contactId = msg.author_participant_id === myParticipant.id 
          ? msg.recipient_participant_id 
          : msg.author_participant_id;
        
        if (!contactId) continue;
        
        if (!contactMap.has(contactId)) {
          // Use private_chat_names first, then fall back to alias_snapshot
          const nameFromChatNames = nameMap.get(contactId);
          const fallbackName = msg.author_participant_id === contactId 
            ? msg.alias_snapshot 
            : 'Anonimo';
          
          contactMap.set(contactId, {
            participantId: contactId,
            displayName: nameFromChatNames || fallbackName || 'Anonimo',
            lastMessageAt: msg.created_at,
            unreadCount: 0 // TODO: implement unread tracking
          });
        }
      }

      setContacts(Array.from(contactMap.values()));
    } catch (error) {
      console.error('Error in fetchConversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user, eventId]);

  // Subscribe to new messages to update contacts
  useEffect(() => {
    if (!user || !eventId) return;

    const channel = supabase
      .channel(`dm_contacts_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.new.channel === 'pair') {
            // Refetch conversations when new DM arrives
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, eventId]);

  return { contacts, loading, refetch: fetchConversations };
}
