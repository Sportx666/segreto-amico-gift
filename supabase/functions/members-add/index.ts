import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateToken(length = 22) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  let step = 'init';
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const accessToken = authHeader.replace('Bearer ', '');
    
    step = 'auth_get_user';
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = userRes.user;

    const { eventId, anonymousName, anonymousEmail, ttlDays = 30 } = await req.json();
    if (!eventId || !anonymousName || typeof anonymousName !== 'string' || !anonymousName.trim()) {
      return new Response(JSON.stringify({ error: 'eventId and anonymousName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (event.admin_profile_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        console.error('Duplicate email check failed:', dupErr);
        throw dupErr;
      }
      if (existingMemberByEmail) {
        console.log('Duplicate email found:', { eventId, email: normalizedEmail, memberId: existingMemberByEmail.id });
        return new Response(JSON.stringify({ error: 'duplicate_email', memberId: existingMemberByEmail.id }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
            console.log('Found existing participant:', { profileId: existingProfileId, participantId });
          } else {
            const { data: newPart, error: newPartErr } = await supabase
              .from('participants')
              .insert({ profile_id: existingProfileId })
              .select('id')
              .single();
            if (newPartErr || !newPart) {
              console.error('Participant creation failed for existing user:', newPartErr);
              throw newPartErr || new Error('Participant creation failed');
            }
            participantId = newPart.id as string;
            console.log('Created new participant for existing user:', { profileId: existingProfileId, participantId });
          }
        }
      } catch (userLookupError) {
        console.log('User lookup failed (expected for new emails):', userLookupError);
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
        console.error('Placeholder participant creation failed:', insPartErr);
        throw insPartErr || new Error('Participant creation failed');
      }
      participantId = placeholder.id as string;
      console.log('Created placeholder participant:', { participantId });
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
      console.error('Event member creation failed:', memberErr);
      throw memberErr || new Error('Membership creation failed');
    }
    console.log('Created event member:', { memberId: memberRow.id, participantId: memberRow.participant_id });

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
      console.error('Join token creation failed:', tokenErr);
      throw tokenErr;
    }
    console.log('Created join token:', { token, expiresAt });

    const origin = 'https://amico-segreto.lovable.app';
    const url = `${origin}/join/${token}`;

    console.log('Member added successfully:', { 
      memberId: memberRow.id, 
      participantId: memberRow.participant_id, 
      eventId,
      anonymousName: anonymousName.trim(),
      hasEmail: !!normalizedEmail
    });

    return new Response(JSON.stringify({
      memberId: memberRow.id,
      participantId: memberRow.participant_id,
      invite: { token, url, expiresAt },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('members-add step error', { 
      step, 
      message: e?.message, 
      details: e?.details || e?.hint,
      code: e?.code
    });
    return new Response(JSON.stringify({ error: e.message || 'Internal error', step, code: e?.code }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});