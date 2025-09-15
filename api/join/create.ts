import { createServiceClient } from '../_supabase.ts';
import crypto from 'crypto';

function generateToken(length = 22) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

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
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { eventId, participantId, ttlDays = 30 } = req.body;
  if (!eventId || !participantId) {
    return res.status(400).json({ error: 'eventId and participantId required' });
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('admin_profile_id')
    .eq('id', eventId)
    .single();
  if (eventError || !event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.admin_profile_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('join_tokens').insert({
    event_id: eventId,
    participant_id: participantId,
    token,
    expires_at: expiresAt,
  });
  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

import { config } from '@/config/env';

  const origin = (config.auth.baseUrl || req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`).replace(/\/$/, "");
  const url = `${origin}/join/${token}`;

  return res.status(200).json({ token, url, expiresAt });
}
