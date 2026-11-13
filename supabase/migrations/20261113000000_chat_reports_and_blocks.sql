-- Chat reporting and blocking (Google Play user-generated-content policy).
--
-- Blocking works on a private chat, not on a person: the exposed side must
-- never learn who the anonymous side is, so the server resolves "the other
-- party" itself. Each (event, anonymous, exposed) pair has exactly one chat,
-- so blocking it stops that person from messaging you anonymously.
--
-- Neither table is readable by clients; reports are reviewed by the app owner
-- (Supabase dashboard / service role).

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

create table if not exists public.chat_blocks (
  private_chat_id uuid not null references public.private_chats(id) on delete cascade,
  blocker_participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (private_chat_id, blocker_participant_id)
);
alter table public.chat_blocks enable row level security;
revoke all on table public.chat_blocks from anon, authenticated;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  private_chat_id uuid references public.private_chats(id) on delete set null,
  reported_participant_id uuid references public.participants(id) on delete set null,
  message_snapshot text,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (message_id is not null or private_chat_id is not null)
);
alter table public.content_reports enable row level security;
revoke all on table public.content_reports from anon, authenticated;
create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

comment on table public.content_reports is
  'User reports of chat messages/conversations. Review in the dashboard and set status to reviewed/actioned/dismissed.';

-------------------------------------------------------------------------------
-- report_content: report one message, or a whole private conversation
-------------------------------------------------------------------------------

create or replace function public.report_content(
  _reason text,
  _message_id uuid default null,
  _private_chat_id uuid default null,
  _details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_msg record;
  v_chat record;
  v_report uuid;
  v_details text := nullif(left(trim(coalesce(_details, '')), 1000), '');
begin
  select p.id into v_me from public.participants p where p.profile_id = auth.uid();
  if v_me is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Validate before inserting: a check-constraint error would echo the whole
  -- row (including the reported participant id) back to the caller.
  if _reason is null or _reason not in ('spam', 'harassment', 'inappropriate', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  if (select count(*) from public.content_reports r
      where r.reporter_profile_id = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_reports' using errcode = '54000';
  end if;

  if _message_id is not null then
    select m.id, m.event_id, m.channel, m.private_chat_id, m.author_participant_id, m.content
      into v_msg
    from public.chat_messages m where m.id = _message_id;

    if v_msg.id is null
       or (v_msg.channel = 'event' and not public.is_event_participant(v_msg.event_id, auth.uid()))
       or (v_msg.channel = 'pair' and not public.is_private_chat_party(v_msg.private_chat_id, auth.uid())) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if v_msg.author_participant_id = v_me then
      raise exception 'cannot_report_own' using errcode = '22023';
    end if;

    insert into public.content_reports (reporter_profile_id, event_id, message_id, private_chat_id,
                                        reported_participant_id, message_snapshot, reason, details)
    values (auth.uid(), v_msg.event_id, v_msg.id, v_msg.private_chat_id,
            v_msg.author_participant_id, v_msg.content, _reason, v_details)
    returning id into v_report;

  elsif _private_chat_id is not null then
    select pc.id, pc.event_id, pc.anonymous_participant_id, pc.exposed_participant_id
      into v_chat
    from public.private_chats pc where pc.id = _private_chat_id;

    if v_chat.id is null or v_me not in (v_chat.anonymous_participant_id, v_chat.exposed_participant_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;

    insert into public.content_reports (reporter_profile_id, event_id, private_chat_id,
                                        reported_participant_id, reason, details)
    values (auth.uid(), v_chat.event_id, v_chat.id,
            case when v_chat.anonymous_participant_id = v_me
                 then v_chat.exposed_participant_id else v_chat.anonymous_participant_id end,
            _reason, v_details)
    returning id into v_report;

  else
    raise exception 'nothing_to_report' using errcode = '22023';
  end if;

  return v_report;
end;
$$;

-------------------------------------------------------------------------------
-- set_private_chat_blocked: block / unblock a private chat I'm part of
-------------------------------------------------------------------------------

create or replace function public.set_private_chat_blocked(_private_chat_id uuid, _blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
begin
  select p.id into v_me from public.participants p where p.profile_id = auth.uid();
  if v_me is null or not exists (
    select 1 from public.private_chats pc
    where pc.id = _private_chat_id and v_me in (pc.anonymous_participant_id, pc.exposed_participant_id)
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if _blocked then
    insert into public.chat_blocks (private_chat_id, blocker_participant_id)
    values (_private_chat_id, v_me)
    on conflict do nothing;
  else
    delete from public.chat_blocks
    where private_chat_id = _private_chat_id and blocker_participant_id = v_me;
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- get_my_private_chats: now also says whether the chat is blocked
-- (return type changes, so drop and recreate)
-------------------------------------------------------------------------------

drop function if exists public.get_my_private_chats(uuid, jsonb);
create function public.get_my_private_chats(_event_id uuid, _last_read jsonb default null)
returns table (
  chat_id uuid,
  my_role text,
  other_participant_id uuid,
  display_name text,
  unread_count bigint,
  last_message_at timestamptz,
  created_at timestamptz,
  blocked_by_me boolean,
  blocked_by_other boolean
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
    pc.created_at,
    exists (select 1 from public.chat_blocks b
            where b.private_chat_id = pc.id and b.blocker_participant_id = me.id),
    exists (select 1 from public.chat_blocks b
            where b.private_chat_id = pc.id and b.blocker_participant_id <> me.id)
  from public.private_chats pc
  join me on me.id in (pc.anonymous_participant_id, pc.exposed_participant_id)
  where pc.event_id = _event_id
  order by pc.last_message_at desc nulls last;
$$;

-------------------------------------------------------------------------------
-- Grants
-------------------------------------------------------------------------------

revoke execute on function public.report_content(text, uuid, uuid, text) from public, anon;
revoke execute on function public.set_private_chat_blocked(uuid, boolean) from public, anon;
revoke execute on function public.get_my_private_chats(uuid, jsonb) from public, anon;
grant execute on function public.report_content(text, uuid, uuid, text) to authenticated;
grant execute on function public.set_private_chat_blocked(uuid, boolean) to authenticated;
grant execute on function public.get_my_private_chats(uuid, jsonb) to authenticated;
