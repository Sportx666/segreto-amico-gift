-- Part A of the 2026-11 security hardening: additive only.
-- Safe to apply while the previous frontend is still live; part B
-- (20261112000100_security_hardening.sql) removes the old direct access.

-------------------------------------------------------------------------------
-- Private chat RPCs used by the new frontend
-------------------------------------------------------------------------------

-- The pair-message policies looked up private_chats as the caller, who can no
-- longer read that table. Do the membership check in a definer helper.
create or replace function public.is_private_chat_party(_chat_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.private_chats pc
    join public.participants p
      on p.id in (pc.anonymous_participant_id, pc.exposed_participant_id)
    where pc.id = _chat_id and p.profile_id = _user_id
  );
$$;
revoke execute on function public.is_private_chat_party(uuid, uuid) from public, anon;
grant execute on function public.is_private_chat_party(uuid, uuid) to authenticated;

-- 1d. List the caller's private chats for an event, from the caller's point of view.
--     other_participant_id is only returned when the caller is the anonymous side.
create or replace function public.get_my_private_chats(_event_id uuid, _last_read jsonb default null)
returns table (
  chat_id uuid,
  my_role text,
  other_participant_id uuid,
  display_name text,
  unread_count bigint,
  last_message_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id from public.participants p where p.profile_id = auth.uid()
  )
  select
    pc.id,
    case when pc.anonymous_participant_id = me.id then 'anonymous' else 'exposed' end,
    case when pc.anonymous_participant_id = me.id then pc.exposed_participant_id end,
    case when pc.anonymous_participant_id = me.id then pc.exposed_name else pc.anonymous_alias end,
    (select count(*) from public.chat_messages cm
      where cm.private_chat_id = pc.id
        and cm.author_participant_id <> me.id
        and (
          _last_read is null
          or _last_read ->> pc.id::text is null
          or cm.created_at > (_last_read ->> pc.id::text)::timestamptz
        )),
    pc.last_message_at,
    pc.created_at
  from public.private_chats pc
  join me on me.id in (pc.anonymous_participant_id, pc.exposed_participant_id)
  where pc.event_id = _event_id
  order by pc.last_message_at desc nulls last;
$$;

-- 1e. Start (or reopen) an anonymous chat with another joined member.
--     Names are computed server-side; the caller must have an alias.
create or replace function public.get_or_create_private_chat(_event_id uuid, _recipient_participant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_alias text;
  v_recipient_name text;
  v_chat uuid;
begin
  select p.id into v_me
  from public.participants p
  join public.event_members em on em.participant_id = p.id
  where p.profile_id = auth.uid() and em.event_id = _event_id and em.status = 'joined';

  if v_me is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  if _recipient_participant_id = v_me then
    raise exception 'cannot_chat_with_self' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(em.display_name), ''), nullif(trim(pr.display_name), ''),
                  nullif(trim(em.anonymous_name), ''), 'Anonimo')
    into v_recipient_name
  from public.event_members em
  join public.participants pa on pa.id = em.participant_id
  left join public.profiles pr on pr.id = pa.profile_id
  where em.event_id = _event_id
    and em.participant_id = _recipient_participant_id
    and em.status = 'joined';

  if v_recipient_name is null then
    raise exception 'recipient_not_in_event' using errcode = '22023';
  end if;

  select a.nickname into v_alias
  from public.anonymous_aliases a
  where a.event_id = _event_id and a.participant_id = v_me;

  if v_alias is null then
    raise exception 'alias_required' using errcode = '22023';
  end if;

  insert into public.private_chats (event_id, anonymous_participant_id, anonymous_alias,
                                    exposed_participant_id, exposed_name)
  values (_event_id, v_me, v_alias, _recipient_participant_id, v_recipient_name)
  on conflict (event_id, anonymous_participant_id, exposed_participant_id)
    do update set event_id = excluded.event_id
  returning id into v_chat;

  return v_chat;
end;
$$;

revoke execute on function public.get_my_private_chats(uuid, jsonb) from public, anon;
revoke execute on function public.get_or_create_private_chat(uuid, uuid) from public, anon;
grant execute on function public.get_my_private_chats(uuid, jsonb) to authenticated;
grant execute on function public.get_or_create_private_chat(uuid, uuid) to authenticated;

-------------------------------------------------------------------------------
-- Auto-draw scheduler secret
--
-- The cron job sent current_setting('app.scheduler_secret'), which was never
-- set, so every run was rejected (401). The secret now lives in Vault: it is
-- generated here, never displayed, read by the cron job, and checked by the
-- edge functions through verify_scheduler_secret() (service role only).
-------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'auto_draw_scheduler_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'auto_draw_scheduler_secret',
      'Shared secret between the auto-draw-daily cron job and the auto-draw-scheduler / draw edge functions'
    );
  end if;
end $$;

create or replace function public.verify_scheduler_secret(_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(length(_secret), 0) >= 32 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'auto_draw_scheduler_secret' and decrypted_secret = _secret
  );
$$;
revoke execute on function public.verify_scheduler_secret(text) from public, anon, authenticated;
grant execute on function public.verify_scheduler_secret(text) to service_role;

-- Same name and schedule as before; cron.schedule replaces the existing job.
select cron.schedule(
  'auto-draw-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://eociecgrdwllggcohmko.supabase.co/functions/v1/auto-draw-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'auto_draw_scheduler_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
