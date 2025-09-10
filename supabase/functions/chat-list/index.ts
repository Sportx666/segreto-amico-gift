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

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get('eventId');
    const channel = url.searchParams.get('channel');
    const recipientId = url.searchParams.get('recipientId');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    if (!eventId || !channel) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId or channel parameter' }),
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

    // Get user's participant ID 
    const { data: userParticipant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (participantError || !userParticipant) {
      console.error('Participant error:', participantError);
      return new Response(
        JSON.stringify({ error: 'User participant not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query based on channel type
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        alias_snapshot,
        color_snapshot,
        created_at,
        author_participant_id,
        channel,
        assignment_id,
        recipient_participant_id
      `)
      .eq('event_id', eventId)
      .eq('channel', channel);

    // For pair channel with recipient, filter messages between user and recipient
    if (channel === 'pair' && recipientId) {
      query = query.or(
        `and(author_participant_id.eq.${userParticipant.id},recipient_participant_id.eq.${recipientId}),and(author_participant_id.eq.${recipientId},recipient_participant_id.eq.${userParticipant.id})`
      );
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        messages: messages || [],
        hasMore: messages?.length === limit
      }),
      { 
        status: 200, 
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