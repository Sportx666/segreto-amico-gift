import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { eventId, channel, content, privateChatId, recipientId } = await req.json();

    if (!eventId || !channel || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId, channel, or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['event', 'pair'].includes(channel)) {
      return new Response(
        JSON.stringify({ error: 'Channel must be "event" or "pair"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate content length
    if (content.trim().length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's participant record for this event
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select(`
        id,
        event_members!inner(event_id)
      `)
      .eq('profile_id', user.id)
      .eq('event_members.event_id', eventId)
      .single();

    if (participantError || !participant) {
      console.error('Participant error:', participantError);
      return new Response(
        JSON.stringify({ error: 'User is not a member of this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const senderRealName = profile?.display_name || 'Anonimo';

    // Get user's current alias for this event
    let aliasSnapshot = senderRealName;
    
    if (channel === 'pair') {
      const { data: alias } = await supabase
        .from('anonymous_aliases')
        .select('nickname')
        .eq('event_id', eventId)
        .eq('participant_id', participant.id)
        .single();
      
      aliasSnapshot = alias?.nickname || senderRealName;
    }

    let messagePrivateChatId = privateChatId;
    let recipientProfileId: string | null = null;

    // For pair channel, handle private chat creation or lookup
    if (channel === 'pair') {
      if (!privateChatId && !recipientId) {
        return new Response(
          JSON.stringify({ error: 'Pair channel requires privateChatId or recipientId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!privateChatId && recipientId) {
        // Create new private chat - sender is anonymous, recipient is exposed
        
        // Get recipient's real name
        const { data: recipientParticipant } = await supabase
          .from('participants')
          .select('profile_id')
          .eq('id', recipientId)
          .single();
        
        let recipientRealName = 'Anonimo';
        if (recipientParticipant?.profile_id) {
          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', recipientParticipant.profile_id)
            .single();
          recipientRealName = recipientProfile?.display_name || 'Anonimo';
          recipientProfileId = recipientParticipant.profile_id;
        } else {
          // Check event_members for anonymous_name
          const { data: eventMember } = await supabase
            .from('event_members')
            .select('anonymous_name, display_name')
            .eq('event_id', eventId)
            .eq('participant_id', recipientId)
            .single();
          recipientRealName = eventMember?.display_name || eventMember?.anonymous_name || 'Anonimo';
        }

        // Check if this exact directional chat already exists
        const { data: existingChat } = await supabase
          .from('private_chats')
          .select('id')
          .eq('event_id', eventId)
          .eq('anonymous_participant_id', participant.id)
          .eq('exposed_participant_id', recipientId)
          .maybeSingle();

        if (existingChat) {
          messagePrivateChatId = existingChat.id;
        } else {
          // Create new directional private chat
          const { data: newChat, error: createError } = await supabase
            .from('private_chats')
            .insert({
              event_id: eventId,
              anonymous_participant_id: participant.id,
              anonymous_alias: aliasSnapshot,
              exposed_participant_id: recipientId,
              exposed_name: recipientRealName,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating private chat:', createError);
            return new Response(
              JSON.stringify({ error: 'Failed to create private chat' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          messagePrivateChatId = newChat.id;
          console.log('Created new private chat:', {
            id: newChat.id,
            anonymous: participant.id,
            exposed: recipientId,
          });
        }
      } else if (privateChatId) {
        // Existing chat - get recipient's profile_id for notifications and correct alias
        const { data: privateChat } = await supabase
          .from('private_chats')
          .select('anonymous_participant_id, exposed_participant_id, anonymous_alias, exposed_name')
          .eq('id', privateChatId)
          .single();

        if (privateChat) {
          const otherParticipantId = privateChat.anonymous_participant_id === participant.id
            ? privateChat.exposed_participant_id
            : privateChat.anonymous_participant_id;

          // Determine correct alias based on sender's role in this chat
          // If sender is anonymous party → use their alias
          // If sender is exposed party → use their real name
          if (privateChat.anonymous_participant_id === participant.id) {
            aliasSnapshot = privateChat.anonymous_alias;
          } else {
            aliasSnapshot = privateChat.exposed_name;
          }

          const { data: otherParticipant } = await supabase
            .from('participants')
            .select('profile_id')
            .eq('id', otherParticipantId)
            .single();

          recipientProfileId = otherParticipant?.profile_id || null;
        }
      }
    }

    // Insert the message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        event_id: eventId,
        channel,
        private_chat_id: channel === 'pair' ? messagePrivateChatId : null,
        author_participant_id: participant.id,
        alias_snapshot: channel === 'pair' ? aliasSnapshot : senderRealName,
        color_snapshot: '#6366f1',
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_message_at on private_chat
    if (channel === 'pair' && messagePrivateChatId) {
      await supabase
        .from('private_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', messagePrivateChatId);
    }

    // Create notifications
    try {
      if (channel === 'event') {
        // Get all other joined participants in this event
        const { data: otherMembers, error: membersError } = await supabase
          .from('event_members')
          .select(`
            participant_id,
            participants!inner(profile_id)
          `)
          .eq('event_id', eventId)
          .eq('status', 'joined')
          .neq('participant_id', participant.id);

        if (!membersError && otherMembers) {
          const notifications = otherMembers
            .filter((m: any) => m.participants?.profile_id)
            .map((m: any) => ({
              profile_id: m.participants.profile_id,
              type: 'chat',
              title: 'Nuovo messaggio',
              body: `${senderRealName} ha scritto nella chat dell'evento`,
              event_id: eventId
            }));

          if (notifications.length > 0) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert(notifications);
            
            if (notifError) {
              console.error('Error creating event chat notifications:', notifError);
            } else {
              console.log(`Created ${notifications.length} notifications for event chat message`);
            }
          }
        }
      } else if (channel === 'pair' && recipientProfileId && messagePrivateChatId) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            profile_id: recipientProfileId,
            type: 'chat',
            title: 'Nuovo messaggio privato',
            body: `${aliasSnapshot} ti ha inviato un messaggio`,
            event_id: eventId,
            private_chat_id: messagePrivateChatId,
          });

        if (notifError) {
          console.error('Error creating pair chat notification:', notifError);
        } else {
          console.log('Created notification for pair chat message');
        }
      }
    } catch (notifErr) {
      console.error('Error in notification creation:', notifErr);
    }

    return new Response(
      JSON.stringify({ message, privateChatId: messagePrivateChatId }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
