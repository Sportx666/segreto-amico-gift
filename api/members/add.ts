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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let supabase;
  let step = 'init';
  try {
    supabase = createServiceClient();
  } catch (e: any) {
    console.error('members/add config error', {
      hasUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      message: e?.message,
    });
    return res.status(500).json({ error: e.message || 'Server configuration error', step });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = authHeader.replace('Bearer ', '');
  step = 'auth_get_user';
  const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userRes?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = userRes.user;

  const { eventId, anonymousName, anonymousEmail, ttlDays = 30 } = req.body || {};
  if (!eventId || !anonymousName || typeof anonymousName !== 'string' || !anonymousName.trim()) {
    return res.status(400).json({ error: 'eventId and anonymousName required' });
  }

  // Normalize email if provided
  const normalizedEmail: string | null = (typeof anonymousEmail === 'string' && anonymousEmail.trim())
    ? String(anonymousEmail).trim().toLowerCase()
    : null;

  // Verify admin
  step = 'load_event_admin';
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, admin_profile_id')
    .eq('id', eventId)
    .single();
  if (eventError || !event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.admin_profile_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // 0) If email provided, guard against duplicates within the same event
    if (normalizedEmail) {
      step = 'check_duplicate_email';
      const { data: existingMemberByEmail, error: dupErr } = await supabase
        .from('event_members')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('anonymous_email', normalizedEmail)
        .maybeSingle();
      if (dupErr) {
        throw dupErr;
      }
      if (existingMemberByEmail) {
        return res.status(409).json({ error: 'duplicate_email', memberId: existingMemberByEmail.id });
      }
    }

    // 1) Create placeholder participant
    step = 'resolve_or_insert_participant';
    let participantId: string | null = null;
    if (normalizedEmail) {
      // Try to link to an existing user by email
      try {
        const { data: userByEmail } = await supabase.auth.admin.getUserByEmail(normalizedEmail);
        const existingProfileId = (userByEmail as any)?.user?.id as string | undefined;
        if (existingProfileId) {
          // Find or create participants row for this profile
          const { data: existingParticipant } = await supabase
            .from('participants')
            .select('id')
            .eq('profile_id', existingProfileId)
            .maybeSingle();
          if (existingParticipant?.id) {
            participantId = existingParticipant.id as string;
          } else {
            const { data: newPart, error: newPartErr } = await supabase
              .from('participants')
              .insert({ profile_id: existingProfileId })
              .select('id')
              .single();
            if (newPartErr || !newPart) {
              throw newPartErr || new Error('Participant creation failed');
            }
            participantId = newPart.id as string;
          }
        }
      } catch {
        // If admin lookup fails, fall back to placeholder participant
      }
    }
    if (!participantId) {
      const { data: placeholder, error: insPartErr } = await supabase
        .from('participants')
        .insert({ profile_id: null })
        .select('id')
        .single();
      if (insPartErr || !placeholder) {
        throw insPartErr || new Error('Participant creation failed');
      }
      participantId = placeholder.id as string;
    }

    // 2) Insert membership row
    step = 'insert_event_member';
    const { data: memberRow, error: memberErr } = await supabase
      .from('event_members')
      .insert({
        event_id: eventId,
        participant_id: participantId,
        anonymous_name: anonymousName.trim(),
        anonymous_email: normalizedEmail,
        role: 'member',
        status: 'invited',
      })
      .select('id, participant_id')
      .single();
    if (memberErr || !memberRow) {
      throw memberErr || new Error('Membership creation failed');
    }

    // 3) Create join token
    step = 'insert_join_token';
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenErr } = await supabase.from('join_tokens').insert({
      event_id: eventId,
      participant_id: memberRow.participant_id,
      token,
      expires_at: expiresAt,
    });
    if (tokenErr) {
      throw tokenErr;
    }

    const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const url = `${origin}/join/${token}`;

    return res.status(200).json({
      memberId: memberRow.id,
      participantId: memberRow.participant_id,
      invite: { token, url, expiresAt },
    });
  } catch (e: any) {
    console.error('members/add step error', { step, message: e?.message, details: e });
    return res.status(500).json({ error: e.message || 'Internal error', step });
  }
}
