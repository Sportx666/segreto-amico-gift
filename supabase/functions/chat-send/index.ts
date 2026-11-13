import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// FCM configuration
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

// Send push notification via FCM
async function sendFCM(
  token: string, 
  title: string, 
  body: string, 
  data?: Record<string, string>
): Promise<{ success: boolean; invalidToken: boolean }> {
  if (!FCM_SERVER_KEY) {
    return { success: false, invalidToken: false };
  }

  try {
    const response = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body, sound: 'default' },
        data,
        priority: 'high',
      }),
    });

    const result = await response.json();
    
    if (result.failure === 1) {
      const errorType = result.results?.[0]?.error;
      // InvalidRegistration or NotRegistered means token is stale
      const invalidToken = ['InvalidRegistration', 'NotRegistered'].includes(errorType);
      return { success: false, invalidToken };
    }
    
    return { success: true, invalidToken: false };
  } catch (error) {
    console.error('FCM send error:', error);
    return { success: false, invalidToken: false };
  }
}

interface PushToken {
  id: string;
  token: string;
}

// Send push notifications to profile IDs
async function sendPushToProfiles(
  supabase: any,
  profileIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!FCM_SERVER_KEY || profileIds.length === 0) return;

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('id, token')
    .in('profile_id', profileIds) as { data: PushToken[] | null };

  if (!tokens || tokens.length === 0) return;

  const invalidTokenIds: string[] = [];

  for (const tokenRecord of tokens) {
    const result = await sendFCM(tokenRecord.token, title, body, data);
    if (result.invalidToken) {
      invalidTokenIds.push(tokenRecord.id);
    }
  }

  // Clean up invalid tokens
  if (invalidTokenIds.length > 0) {
    await supabase.from('push_tokens').delete().in('id', invalidTokenIds);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { eventId, channel, content, privateChatId, recipientId } = await req.json();
    const text = typeof content === 'string' ? content.trim() : '';

    if (!isUuid(eventId) || !channel || !text) {
      return json({ error: 'Missing eventId, channel, or content' }, 400);
    }
    if (!['event', 'pair'].includes(channel)) {
      return json({ error: 'Channel must be "event" or "pair"' }, 400);
    }
    if (text.length > 2000) {
      return json({ error: 'Message too long (max 2000 characters)' }, 400);
    }
    if (channel === 'pair' && !isUuid(privateChatId) && !isUuid(recipientId)) {
      return json({ error: 'Pair channel requires privateChatId or recipientId' }, 400);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Invalid authentication' }, 401);

    // Sender must be a joined member of this event
    const { data: participant } = await supabase
      .from('participants')
      .select('id, event_members!inner(event_id, status)')
      .eq('profile_id', user.id)
      .eq('event_members.event_id', eventId)
      .eq('event_members.status', 'joined')
      .maybeSingle();
    if (!participant) return json({ error: 'User is not a member of this event' }, 403);

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    const senderRealName = profile?.display_name || 'Anonimo';

    let aliasSnapshot = senderRealName;
    let messagePrivateChatId: string | null = null;
    let recipientProfileId: string | null = null;

    if (channel === 'pair') {
      if (isUuid(privateChatId)) {
        // Existing chat: the sender must be one of its two parties, in this event
        const { data: privateChat } = await supabase
          .from('private_chats')
          .select('event_id, anonymous_participant_id, exposed_participant_id, anonymous_alias, exposed_name')
          .eq('id', privateChatId)
          .maybeSingle();

        const isAnonymousSide = privateChat?.anonymous_participant_id === participant.id;
        const isExposedSide = privateChat?.exposed_participant_id === participant.id;
        if (!privateChat || privateChat.event_id !== eventId || (!isAnonymousSide && !isExposedSide)) {
          return json({ error: 'Access denied to this private chat' }, 403);
        }

        messagePrivateChatId = privateChatId;
        aliasSnapshot = isAnonymousSide ? privateChat.anonymous_alias : privateChat.exposed_name;
        const otherParticipantId = isAnonymousSide
          ? privateChat.exposed_participant_id
          : privateChat.anonymous_participant_id;

        const { data: other } = await supabase
          .from('participants')
          .select('profile_id')
          .eq('id', otherParticipantId)
          .single();
        recipientProfileId = other?.profile_id ?? null;
      } else {
        // New chat: sender is the anonymous side and must have an alias,
        // otherwise their real name would be shown.
        if (recipientId === participant.id) return json({ error: 'cannot_chat_with_self' }, 400);

        const { data: recipient } = await supabase
          .from('event_members')
          .select('display_name, anonymous_name, participants!inner(profile_id, profiles(display_name))')
          .eq('event_id', eventId)
          .eq('participant_id', recipientId)
          .eq('status', 'joined')
          .maybeSingle();
        if (!recipient) return json({ error: 'recipient_not_in_event' }, 400);

        const { data: alias } = await supabase
          .from('anonymous_aliases')
          .select('nickname')
          .eq('event_id', eventId)
          .eq('participant_id', participant.id)
          .maybeSingle();
        if (!alias?.nickname) return json({ error: 'alias_required' }, 400);

        aliasSnapshot = alias.nickname;
        // deno-lint-ignore no-explicit-any
        const rp = (recipient as any).participants;
        recipientProfileId = rp?.profile_id ?? null;
        const recipientName =
          recipient.display_name?.trim() || rp?.profiles?.display_name?.trim() ||
          recipient.anonymous_name?.trim() || 'Anonimo';

        const { data: chat, error: chatError } = await supabase
          .from('private_chats')
          .upsert(
            {
              event_id: eventId,
              anonymous_participant_id: participant.id,
              anonymous_alias: aliasSnapshot,
              exposed_participant_id: recipientId,
              exposed_name: recipientName,
            },
            { onConflict: 'event_id,anonymous_participant_id,exposed_participant_id', ignoreDuplicates: false },
          )
          .select('id, anonymous_alias')
          .single();
        if (chatError || !chat) {
          console.error('Error creating private chat:', chatError);
          return json({ error: 'Failed to create private chat' }, 500);
        }
        messagePrivateChatId = chat.id;
      }
    }

    // A blocked private chat accepts no messages from either side
    if (messagePrivateChatId) {
      const { count: blocks } = await supabase
        .from('chat_blocks')
        .select('private_chat_id', { count: 'exact', head: true })
        .eq('private_chat_id', messagePrivateChatId);
      if (blocks) return json({ error: 'chat_blocked' }, 403);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        event_id: eventId,
        channel,
        private_chat_id: messagePrivateChatId,
        author_participant_id: participant.id,
        alias_snapshot: aliasSnapshot,
        color_snapshot: '#6366f1',
        content: text,
      })
      .select('id, content, alias_snapshot, color_snapshot, created_at, channel, private_chat_id')
      .single();

    if (insertError || !inserted) {
      console.error('Error inserting message:', insertError);
      return json({ error: 'Failed to send message' }, 500);
    }

    if (messagePrivateChatId) {
      await supabase
        .from('private_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', messagePrivateChatId);
    }

    // Notifications + push (best effort)
    try {
      if (channel === 'event') {
        const { data: otherMembers, error: membersError } = await supabase
          .from('event_members')
          .select('participant_id, participants!inner(profile_id)')
          .eq('event_id', eventId)
          .eq('status', 'joined')
          .neq('participant_id', participant.id);

        if (!membersError && otherMembers) {
          const profileIds = otherMembers
            // deno-lint-ignore no-explicit-any
            .map((m: any) => m.participants?.profile_id)
            .filter(Boolean) as string[];

          if (profileIds.length > 0) {
            const body = `${senderRealName} ha scritto nella chat dell'evento`;
            const { error: notifError } = await supabase.from('notifications').insert(
              profileIds.map((pid) => ({ profile_id: pid, type: 'chat', title: 'Nuovo messaggio', body, event_id: eventId })),
            );
            if (notifError) {
              console.error('Error creating event chat notifications:', notifError);
            } else {
              sendPushToProfiles(supabase, profileIds, 'Nuovo messaggio', body, { eventId, type: 'chat' })
                .catch((err) => console.error('Push notification error:', err));
            }
          }
        }
      } else if (recipientProfileId && messagePrivateChatId) {
        const body = `${aliasSnapshot} ti ha inviato un messaggio`;
        const { error: notifError } = await supabase.from('notifications').insert({
          profile_id: recipientProfileId,
          type: 'chat',
          title: 'Nuovo messaggio privato',
          body,
          event_id: eventId,
          private_chat_id: messagePrivateChatId,
        });
        if (notifError) {
          console.error('Error creating pair chat notification:', notifError);
        } else {
          sendPushToProfiles(supabase, [recipientProfileId], 'Nuovo messaggio privato', body, {
            eventId,
            type: 'chat',
            privateChatId: messagePrivateChatId,
          }).catch((err) => console.error('Push notification error:', err));
        }
      }
    } catch (notifErr) {
      console.error('Error in notification creation:', notifErr);
    }

    return json({ message: { ...inserted, is_mine: true }, privateChatId: messagePrivateChatId }, 201);
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
