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

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }

  try {
    const { data: jt, error } = await supabase
      .from('join_tokens')
      .select('event_id, participant_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (error || !jt) {
      return res.status(400).json({ error: 'invalid' });
    }

    if (jt.used_at) {
      return res.status(400).json({ error: 'used' });
    }

    if (new Date(jt.expires_at) < new Date()) {
      return res.status(400).json({ error: 'expired' });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const accessToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    await supabase
      .from('participants')
      .update({ profile_id: user.id })
      .eq('id', jt.participant_id)
      .is('profile_id', null);

    await supabase
      .from('event_members')
      .update({ status: 'joined' })
      .eq('event_id', jt.event_id)
      .eq('participant_id', jt.participant_id);

    await supabase
      .from('join_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return res.status(200).json({ eventId: jt.event_id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
