import { createServiceClient } from '../_supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
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
    const { eventId, channel, content } = await req.json();

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
    const supabase = createServiceClient();

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
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

    // Resolve assignment_id if channel is 'pair'
    let assignmentId = null;
    if (channel === 'pair') {
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

    // Insert the message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        event_id: eventId,
        channel,
        assignment_id: assignmentId,
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
}