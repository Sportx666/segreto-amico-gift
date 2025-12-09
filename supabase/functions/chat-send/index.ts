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
    const { eventId, channel, content, recipientId } = await req.json();

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

    // Get user's current alias for this event (or use display name as fallback)
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    let aliasSnapshot = profile?.display_name || 'Anonimo';
    
    // Use nickname only for pair channel (private chat)
    if (channel === 'pair') {
      const { data: alias } = await supabase
        .from('anonymous_aliases')
        .select('nickname')
        .eq('event_id', eventId)
        .eq('participant_id', participant.id)
        .single();
      
      aliasSnapshot = alias?.nickname || profile?.display_name || 'Anonimo';
    }

    // Resolve assignment_id and recipient_participant_id based on channel and recipientId
    let assignmentId = null;
    let recipientParticipantId = null;
    
    if (channel === 'pair') {
      if (recipientId) {
        // Direct messaging - use recipientId
        recipientParticipantId = recipientId;
      } else {
        // Legacy assignment-based messaging
        const { data: assignment } = await supabase
          .from('assignments')
          .select('id')
          .eq('event_id', eventId)
          .or(`giver_id.eq.${participant.id},receiver_id.eq.${participant.id}`)
          .single();

        if (!assignment) {
          return new Response(
            JSON.stringify({ error: 'No assignment found for pair chat' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        assignmentId = assignment.id;
      }
    }

    // Insert the message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        event_id: eventId,
        channel,
        assignment_id: assignmentId,
        recipient_participant_id: recipientParticipantId,
        author_participant_id: participant.id,
        alias_snapshot: aliasSnapshot,
        color_snapshot: '#6366f1', // Default color
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

    // Create notifications for chat messages
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
          // Insert notifications for each participant
          const notifications = otherMembers
            .filter((m: any) => m.participants?.profile_id)
            .map((m: any) => ({
              profile_id: m.participants.profile_id,
              type: 'chat',
              title: 'Nuovo messaggio',
              body: `${aliasSnapshot} ha scritto nella chat dell'evento`,
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
      } else if (channel === 'pair' && recipientParticipantId) {
        // Get recipient's profile_id
        const { data: recipientData, error: recipientError } = await supabase
          .from('participants')
          .select('profile_id')
          .eq('id', recipientParticipantId)
          .single();

        if (!recipientError && recipientData?.profile_id) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              profile_id: recipientData.profile_id,
              type: 'chat',
              title: 'Nuovo messaggio privato',
              body: `${aliasSnapshot} ti ha inviato un messaggio`,
              event_id: eventId,
              recipient_participant_id: participant.id // sender's participant_id for opening chat
            });

          if (notifError) {
            console.error('Error creating pair chat notification:', notifError);
          } else {
            console.log('Created notification for pair chat message');
          }
        }
      }
    } catch (notifErr) {
      // Log but don't fail the request if notification creation fails
      console.error('Error in notification creation:', notifErr);
    }

    return new Response(
      JSON.stringify({ message }),
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
