import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get('eventId');
    const channel = url.searchParams.get('channel');
    const privateChatId = url.searchParams.get('privateChatId');
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0') || 0);
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 100);

    if (!eventId || !UUID_RE.test(eventId) || !channel) {
      return json({ error: 'Missing eventId or channel parameter' }, 400);
    }
    if (!['event', 'pair'].includes(channel)) {
      return json({ error: 'Channel must be "event" or "pair"' }, 400);
    }
    if (channel === 'pair' && (!privateChatId || !UUID_RE.test(privateChatId))) {
      return json({ error: 'Pair channel requires privateChatId parameter' }, 400);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Invalid authentication' }, 401);

    // Caller must be a joined member of this event
    const { data: me } = await supabase
      .from('participants')
      .select('id, event_members!inner(event_id, status)')
      .eq('profile_id', user.id)
      .eq('event_members.event_id', eventId)
      .eq('event_members.status', 'joined')
      .maybeSingle();
    if (!me) return json({ error: 'Not a member of this event' }, 403);

    let query = supabase
      .from('chat_messages')
      .select('id, content, alias_snapshot, color_snapshot, created_at, author_participant_id, channel, private_chat_id')
      .eq('event_id', eventId)
      .eq('channel', channel);

    if (channel === 'pair') {
      const { data: privateChat } = await supabase
        .from('private_chats')
        .select('event_id, anonymous_participant_id, exposed_participant_id')
        .eq('id', privateChatId!)
        .maybeSingle();

      if (
        !privateChat ||
        privateChat.event_id !== eventId ||
        (privateChat.anonymous_participant_id !== me.id && privateChat.exposed_participant_id !== me.id)
      ) {
        return json({ error: 'Access denied to this private chat' }, 403);
      }
      query = query.eq('private_chat_id', privateChatId!);
    }

    const { data: rows, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return json({ error: 'Failed to fetch messages' }, 500);
    }

    // Never expose who wrote a message: in a private chat that would reveal
    // the anonymous Secret Santa. Only tell the caller which ones are theirs.
    const messages = (rows ?? []).map(({ author_participant_id, ...m }) => ({
      ...m,
      is_mine: author_participant_id === me.id,
    }));

    return json({ messages, hasMore: messages.length === limit });
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
