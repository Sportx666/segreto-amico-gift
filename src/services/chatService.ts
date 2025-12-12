import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  content: string;
  alias_snapshot: string;
  color_snapshot: string;
  created_at: string;
  author_participant_id: string;
  channel: string;
  private_chat_id?: string;
  // Optimistic UI fields
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
}

export interface PrivateChat {
  id: string;
  eventId: string;
  myRole: 'anonymous' | 'exposed';
  myParticipantId: string;
  otherParticipantId: string;
  displayName: string;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

const SUPABASE_URL = 'https://eociecgrdwllggcohmko.supabase.co';

// Cache for participant lookups
const participantCache = new Map<string, { id: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const chatService = {
  /**
   * Get cached participant ID or fetch from DB
   */
  async getParticipantId(userId: string): Promise<string | null> {
    const cached = participantCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.id;
    }

    const { data, error } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', userId)
      .single();

    if (error || !data) return null;

    participantCache.set(userId, { id: data.id, timestamp: Date.now() });
    return data.id;
  },

  /**
   * Fetch messages with pagination
   */
  async fetchMessages(
    eventId: string,
    channel: 'event' | 'pair',
    accessToken: string,
    options: {
      privateChatId?: string;
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const { privateChatId, offset = 0, limit = 25 } = options;

    let url = `${SUPABASE_URL}/functions/v1/chat-list?eventId=${eventId}&channel=${channel}&offset=${offset}&limit=${limit}`;
    
    if (channel === 'pair' && privateChatId) {
      url += `&privateChatId=${privateChatId}`;
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    return response.json();
  },

  /**
   * Send a message with optimistic update support
   */
  async sendMessage(
    eventId: string,
    channel: 'event' | 'pair',
    content: string,
    accessToken: string,
    options: {
      privateChatId?: string;
      recipientId?: string;
    } = {}
  ): Promise<{ message: ChatMessage; privateChatId?: string }> {
    const body: Record<string, string> = {
      eventId,
      channel,
      content: content.trim(),
    };

    if (channel === 'pair') {
      if (options.privateChatId) {
        body.privateChatId = options.privateChatId;
      } else if (options.recipientId) {
        body.recipientId = options.recipientId;
      }
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  },

  /**
   * Fetch private chats with batched unread counts
   */
  async fetchPrivateChats(
    userId: string,
    eventId: string,
    lastReadTimestamps: Record<string, string>
  ): Promise<PrivateChat[]> {
    // Get participant ID (cached)
    const participantId = await this.getParticipantId(userId);
    if (!participantId) return [];

    // Fetch chats and unread counts in parallel
    const [chatsResult, unreadResult] = await Promise.all([
      supabase
        .from('private_chats')
        .select('*')
        .eq('event_id', eventId)
        .or(`anonymous_participant_id.eq.${participantId},exposed_participant_id.eq.${participantId}`)
        .order('last_message_at', { ascending: false }),
      
      supabase.rpc('get_private_chat_unread_counts', {
        _participant_id: participantId,
        _event_id: eventId,
        _last_read_timestamps: lastReadTimestamps,
      }),
    ]);

    if (chatsResult.error) {
      console.error('Error fetching private chats:', chatsResult.error);
      return [];
    }

    // Create unread count map
    const unreadMap = new Map<string, number>();
    if (!unreadResult.error && unreadResult.data) {
      for (const row of unreadResult.data) {
        unreadMap.set(row.chat_id, Number(row.unread_count));
      }
    }

    // Format chats
    return (chatsResult.data || []).map((chat: any) => {
      const isAnonymous = chat.anonymous_participant_id === participantId;
      return {
        id: chat.id,
        eventId: chat.event_id,
        myRole: isAnonymous ? 'anonymous' : 'exposed',
        myParticipantId: participantId,
        otherParticipantId: isAnonymous ? chat.exposed_participant_id : chat.anonymous_participant_id,
        displayName: isAnonymous ? chat.exposed_name : chat.anonymous_alias,
        unreadCount: unreadMap.get(chat.id) || 0,
        lastMessageAt: chat.last_message_at,
        createdAt: chat.created_at,
      };
    });
  },

  /**
   * Create optimistic message for immediate UI feedback
   */
  createOptimisticMessage(
    content: string,
    authorParticipantId: string,
    channel: 'event' | 'pair',
    alias: string,
    privateChatId?: string
  ): ChatMessage {
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      alias_snapshot: alias,
      color_snapshot: '#6366f1',
      created_at: new Date().toISOString(),
      author_participant_id: authorParticipantId,
      channel,
      private_chat_id: privateChatId,
      pending: true,
      tempId: `temp-${Date.now()}`,
    };
  },
};
