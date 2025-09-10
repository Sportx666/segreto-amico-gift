import { createServiceClient } from '../_supabase.ts';

export default async function handler(req: any, res: any) {
  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const accessToken = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'token_required' });
  }

  // Load token row
  const { data: jt, error: jtErr } = await supabase
    .from('join_tokens')
    .select('event_id, participant_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (jtErr || !jt) {
    return res.status(400).json({ error: 'invalid' });
  }
  if (jt.used_at) {
    return res.status(400).json({ error: 'used' });
  }
  if (new Date(jt.expires_at) < new Date()) {
    return res.status(400).json({ error: 'expired' });
  }

  let participantId = jt.participant_id as string | null;

  if (participantId) {
    // Load participant
    const { data: participant, error: partErr } = await supabase
      .from('participants')
      .select('id, profile_id')
      .eq('id', participantId)
      .single();
    if (partErr || !participant) {
      return res.status(400).json({ error: 'invalid' });
    }
    if (participant.profile_id && participant.profile_id !== user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!participant.profile_id) {
      await supabase
        .from('participants')
        .update({ profile_id: user.id })
        .eq('id', participantId)
        .is('profile_id', null);
    }
  } else {
    // Generic invite - create or reuse participant bound to user
    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (existing?.id) {
      participantId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('participants')
        .insert({ profile_id: user.id })
        .select('id')
        .single();
      if (insErr || !inserted) {
        return res.status(500).json({ error: insErr?.message || 'participant_create_failed' });
      }
      participantId = inserted.id;
    }
  }

  // Upsert event membership
  const { data: memberRow, error: memberErr } = await supabase
    .from('event_members')
    .upsert({
      event_id: jt.event_id,
      participant_id: participantId,
      role: 'member',
      status: 'joined',
    }, { onConflict: 'event_id,participant_id' })
    .select('id')
    .single();
  if (memberErr || !memberRow) {
    return res.status(500).json({ error: memberErr?.message || 'member_upsert_failed' });
  }

  // Fix any duplicate memberships and check for merging
  const { data: fixResult, error: fixErr } = await supabase.rpc(
    'fix_event_membership_duplicates',
    { _event_id: jt.event_id, _profile_id: user.id }
  );
  if (fixErr) {
    console.warn('Failed to fix duplicates:', fixErr);
  }

  // If duplicates were merged, notify admin
  if (fixResult?.merged_pids?.length > 0) {
    try {
      // Get admin email
      const { data: event } = await supabase
        .from('events')
        .select('admin_profile_id')
        .eq('id', jt.event_id)
        .single();
      
      if (event?.admin_profile_id) {
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', event.admin_profile_id)
          .single();
        
        if (adminProfile?.email) {
          // Send merge notification
          await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1/mail-merge-notice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              adminEmail: adminProfile.email,
              eventId: jt.event_id,
              profileId: user.id,
              mergedPids: fixResult.merged_pids
            })
          });
        }
      }
    } catch (mailErr) {
      console.warn('Failed to send merge notification:', mailErr);
    }
  }

  // Ensure default wishlist exists
  const { data: wl } = await supabase
    .from('wishlists')
    .select('id')
    .eq('event_id', jt.event_id)
    .eq('owner_id', participantId)
    .maybeSingle();
  if (!wl) {
    await supabase
      .from('wishlists')
      .insert({ event_id: jt.event_id, owner_id: participantId, title: 'La mia lista' });
  }

  // Mark token as used
  await supabase
    .from('join_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  return res.status(200).json({ redirect: `/events/${jt.event_id}` });
}
