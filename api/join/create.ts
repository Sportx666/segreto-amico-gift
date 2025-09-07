import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = "https://eociecgrdwllggcohmko.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvY2llY2dyZHdsbGdnY29obWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODc5ODcsImV4cCI6MjAzMTk2Mzk4N30.frsU_PCHKJdz8lFv2IXqOiUVFwk28hXbZGWZAoYFfBY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

  const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const url = `${origin}/join/${token}`;

  return res.status(200).json({ token, url, expiresAt });
}
