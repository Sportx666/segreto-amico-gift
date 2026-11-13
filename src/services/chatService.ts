import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  content: string;
  alias_snapshot: string;
  color_snapshot: string;
  created_at: string;
  /** True for messages written by the current user. The author's identity is never sent to clients. */
  is_mine?: boolean;
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
  /** Only known when I'm the anonymous side (the recipient's id). Never revealed to the exposed side. */
  otherParticipantId: string | null;
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
   * Fetch my private chats for an event, with unread counts, in one call.
   * The server decides what each side may see: the exposed side only gets the alias.
   */
  async fetchPrivateChats(
    eventId: string,
    lastReadTimestamps: Record<string, string>
  ): Promise<PrivateChat[]> {
    const { data, error } = await supabase.rpc('get_my_private_chats', {
      _event_id: eventId,
      _last_read: lastReadTimestamps,
    });

    if (error) {
      console.error('Error fetching private chats:', error);
      return [];
    }

    return (data || []).map((chat) => ({
      id: chat.chat_id,
      eventId,
      myRole: chat.my_role === 'anonymous' ? 'anonymous' : 'exposed',
      otherParticipantId: chat.other_participant_id,
      displayName: chat.display_name,
      unreadCount: Number(chat.unread_count) || 0,
      lastMessageAt: chat.last_message_at,
      createdAt: chat.created_at,
    }));
  },

  /**
   * Open (or create) my anonymous chat with another joined member.
   * Throws an Error whose message is the server code, e.g. 'alias_required'.
   */
  async getOrCreatePrivateChat(eventId: string, recipientParticipantId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_private_chat', {
      _event_id: eventId,
      _recipient_participant_id: recipientParticipantId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'chat_create_failed');
    }
    return data;
  },

  /**
   * Create optimistic message for immediate UI feedback
   */
  createOptimisticMessage(
    content: string,
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
      is_mine: true,
      channel,
      private_chat_id: privateChatId,
      pending: true,
      tempId: `temp-${Date.now()}`,
    };
  },
};
