import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const userId = userData.user.id;
    const email = userData.user.email?.toLowerCase() ?? null;

    // Collect all participant IDs for this user
    const { data: participants } = await admin
      .from('participants')
      .select('id')
      .eq('profile_id', userId);
    const participantIds = (participants ?? []).map((p) => p.id);

    // Collect all events admin'd by this user
    const { data: ownedEvents } = await admin
      .from('events')
      .select('id')
      .eq('admin_profile_id', userId);
    const ownedEventIds = (ownedEvents ?? []).map((e) => e.id);

    // --- Cleanup events the user administers (cascade-equivalent) ---
    if (ownedEventIds.length > 0) {
      // Wishlist items first (FK-free but logical), then wishlists
      const { data: wls } = await admin
        .from('wishlists')
        .select('id')
        .in('event_id', ownedEventIds);
      const wlIds = (wls ?? []).map((w) => w.id);
      if (wlIds.length > 0) {
        await admin.from('wishlist_items').delete().in('wishlist_id', wlIds);
      }
      await admin.from('wishlists').delete().in('event_id', ownedEventIds);
      await admin.from('chat_messages').delete().in('event_id', ownedEventIds);
      await admin.from('private_chats').delete().in('event_id', ownedEventIds);
      await admin.from('notifications').delete().in('event_id', ownedEventIds);
      await admin.from('anonymous_aliases').delete().in('event_id', ownedEventIds);
      await admin.from('assignments').delete().in('event_id', ownedEventIds);
      await admin.from('exclusions').delete().in('event_id', ownedEventIds);
      await admin.from('join_tokens').delete().in('event_id', ownedEventIds);
      await admin.from('event_members').delete().in('event_id', ownedEventIds);
      await admin.from('events').delete().in('id', ownedEventIds);
    }

    // --- Cleanup data tied to this user's participant rows in other events ---
    if (participantIds.length > 0) {
      // Wishlist items owned + items where this participant is purchaser
      const { data: userWls } = await admin
        .from('wishlists')
        .select('id')
        .in('owner_id', participantIds);
      const userWlIds = (userWls ?? []).map((w) => w.id);
      if (userWlIds.length > 0) {
        await admin.from('wishlist_items').delete().in('wishlist_id', userWlIds);
      }
      await admin.from('wishlists').delete().in('owner_id', participantIds);

      // Null out purchased_by references so other users keep their items
      await admin
        .from('wishlist_items')
        .update({ purchased_by: null, is_purchased: false })
        .in('purchased_by', participantIds);

      // Chat / messaging
      await admin.from('chat_messages').delete().in('author_participant_id', participantIds);
      await admin
        .from('private_chats')
        .delete()
        .or(
          `anonymous_participant_id.in.(${participantIds.join(',')}),exposed_participant_id.in.(${participantIds.join(',')})`,
        );
      await admin.from('anonymous_aliases').delete().in('participant_id', participantIds);

      // Assignments / exclusions involving this user as giver or receiver
      await admin.from('assignments').delete().in('giver_id', participantIds);
      await admin.from('assignments').delete().in('receiver_id', participantIds);
      await admin.from('exclusions').delete().in('giver_id', participantIds);
      await admin.from('exclusions').delete().in('blocked_id', participantIds);

      // Notifications tied to this participant
      await admin.from('notifications').delete().in('recipient_participant_id', participantIds);

      // Join tokens + memberships
      await admin.from('join_tokens').delete().in('participant_id', participantIds);
      await admin.from('event_members').delete().in('participant_id', participantIds);

      // Finally participants
      await admin.from('participants').delete().in('id', participantIds);
    }

    // Profile-scoped tables
    await admin.from('notifications').delete().eq('profile_id', userId);
    await admin.from('notification_settings').delete().eq('profile_id', userId);
    await admin.from('push_tokens').delete().eq('profile_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    // Block re-registration with same email
    if (email) {
      await admin
        .from('blocked_emails')
        .upsert({ email, reason: 'account_deleted' }, { onConflict: 'email' });
    }

    // Finally, delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('auth.admin.deleteUser failed', delErr);
      return json({ error: 'Failed to delete auth user', detail: delErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('delete-account error', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
