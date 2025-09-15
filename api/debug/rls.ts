import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '../_supabase.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventId = req.body?.eventId || req.query?.eventId;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config } from '@/config/env';

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = config.supabase.serverUrl || config.supabase.url;
    const anon = config.supabase.anonKey;
  if (!url || !anon) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = authHeader.replace('Bearer ', '');

  let userId: string | null = null;
  try {
    const svc = createServiceClient();
    const { data: userRes, error: userErr } = await svc.auth.getUser(accessToken);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    userId = userRes.user.id;
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Server configuration error' });
  }

  const userClient = createClient(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const checks: Record<string, any> = {};

  // Check 1: can select participants for own profile
  try {
    const { data, error } = await userClient
      .from('participants')
      .select('id')
      .eq('profile_id', userId!)
      .limit(1);
    checks.participants_select_self = { ok: !error, count: data?.length ?? 0, error: error?.message };
  } catch (e: any) {
    checks.participants_select_self = { ok: false, error: e.message };
  }

  // Check 2: can insert participants with null profile_id (what UI does for guests)
  let tempParticipantId: string | null = null;
  try {
    const ins = await userClient
      .from('participants')
      .insert({ profile_id: null })
      .select('id')
      .single();
    if (ins.error) throw ins.error;
    tempParticipantId = (ins.data as any)?.id ?? null;
    checks.participants_insert_null = { ok: true, id: tempParticipantId };
  } catch (e: any) {
    checks.participants_insert_null = { ok: false, error: e.message };
  }

  // Check 3: can insert event_members for given event (admin-only usually)
  let tempMemberId: string | null = null;
  if (eventId && tempParticipantId) {
    try {
      const ins = await userClient
        .from('event_members')
        .insert({
          event_id: eventId,
          participant_id: tempParticipantId,
          role: 'member',
          status: 'invited',
        })
        .select('id')
        .single();
      if (ins.error) throw ins.error;
      tempMemberId = (ins.data as any)?.id ?? null;
      checks.event_members_insert = { ok: true, id: tempMemberId };
    } catch (e: any) {
      checks.event_members_insert = { ok: false, error: e.message };
    }
  } else if (eventId) {
    checks.event_members_insert = { ok: false, skipped: true, reason: 'No temp participant to attach' };
  }

  // Cleanup if we inserted anything, via service client to bypass RLS
  try {
    const svc = createServiceClient();
    if (tempMemberId) {
      await svc.from('event_members').delete().eq('id', tempMemberId);
    }
    if (tempParticipantId) {
      await svc.from('participants').delete().eq('id', tempParticipantId);
    }
  } catch {}

  return res.status(200).json({ ok: true, userId, checks });
}
