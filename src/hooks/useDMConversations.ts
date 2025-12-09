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

      // Group by contact (the other participant)
      const contactMap = new Map<string, DMContact>();
      
      for (const msg of messages || []) {
        const contactId = msg.author_participant_id === myParticipant.id 
          ? msg.recipient_participant_id 
          : msg.author_participant_id;
        
        if (!contactId) continue;
        
        if (!contactMap.has(contactId)) {
          // Use alias_snapshot from the contact's messages as display name
          const contactName = msg.author_participant_id === contactId 
            ? msg.alias_snapshot 
            : 'Anonimo';
          
          contactMap.set(contactId, {
            participantId: contactId,
            displayName: contactName || 'Anonimo',
            lastMessageAt: msg.created_at,
            unreadCount: 0 // TODO: implement unread tracking
          });
        }
      }

      // Also fetch display names from aliases for better accuracy
      const contactIds = Array.from(contactMap.keys());
      if (contactIds.length > 0) {
        const { data: aliases } = await supabase
          .from('anonymous_aliases')
          .select('participant_id, nickname')
          .eq('event_id', eventId)
          .in('participant_id', contactIds);

        for (const alias of aliases || []) {
          const contact = contactMap.get(alias.participant_id);
          if (contact && alias.nickname) {
            contact.displayName = alias.nickname;
          }
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
