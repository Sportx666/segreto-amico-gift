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

    // Get event members for this event to verify membership
    const { data: members, error: membersError } = await supabase
      .rpc('list_event_members', { _event_id: eventId });

    if (membersError) {
      console.error('Members error:', membersError);
      return new Response(
        JSON.stringify({ error: 'User is not a member of this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's participant ID from members list
    const { data: userParticipant } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!userParticipant) {
      return new Response(
        JSON.stringify({ error: 'User participant not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find current user in members list
    const currentMember = members?.find(m => m.participant_id === userParticipant.id);
    if (!currentMember) {
      return new Response(
        JSON.stringify({ error: 'User is not a member of this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use event display name for event channel, nickname for pair channel
    let aliasSnapshot = currentMember.event_display_name;
    
    if (channel === 'pair' && currentMember.anonymous_name) {
      aliasSnapshot = currentMember.anonymous_name;
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
          .or(`giver_id.eq.${userParticipant.id},receiver_id.eq.${userParticipant.id}`)
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
        author_participant_id: userParticipant.id,
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