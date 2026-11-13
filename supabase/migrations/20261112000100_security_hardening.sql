-- Part B of the 2026-11 security hardening (review of 2026-11-12).
--
-- Apply AFTER part A (20261112000000_private_chat_rpcs.sql) and after the new
-- frontend is live: the client no longer reads private_chats or
-- chat_messages.author_participant_id directly, it uses
-- get_my_private_chats() / get_or_create_private_chat().

-------------------------------------------------------------------------------
-- 1. Secret Santa anonymity
-------------------------------------------------------------------------------

-- 1a. private_chats: no direct client access. Reading goes through
--     get_my_private_chats(), which hides the anonymous side's identity
--     from the exposed side. Creation goes through get_or_create_private_chat()
--     or the chat-send edge function (service role).
revoke all on table public.private_chats from anon, authenticated;
drop policy if exists "Users can create private chats as anonymous party" on public.private_chats;

-- 1b. chat_messages: hide who wrote a message. Clients may only read the
--     display columns; writes go through the chat-send edge function.
revoke all on table public.chat_messages from anon, authenticated;
grant select (id, event_id, channel, private_chat_id, alias_snapshot, color_snapshot, content, created_at)
  on table public.chat_messages to authenticated;

drop policy if exists chat_select_pair_messages_v2 on public.chat_messages;
create policy chat_select_pair_messages_v2 on public.chat_messages
  for select to authenticated
  using (
    channel = 'pair'
    and private_chat_id is not null
    and public.is_private_chat_party(private_chat_id, auth.uid())
  );

-- Writes now only happen through the chat-send edge function.
drop policy if exists chat_insert_pair_messages_v2 on public.chat_messages;
drop policy if exists chat_insert_event_messages on public.chat_messages;
drop policy if exists chat_delete_own_messages on public.chat_messages;

-- 1c. anonymous_aliases: you can only see and manage your own alias.
--     (Previously every event member could map alias -> participant.)
drop policy if exists "Event members can view aliases" on public.anonymous_aliases;
drop policy if exists "Users can manage their own aliases" on public.anonymous_aliases;
revoke all on table public.anonymous_aliases from anon;
drop policy if exists aliases_select_own on public.anonymous_aliases;
drop policy if exists aliases_insert_own on public.anonymous_aliases;
drop policy if exists aliases_update_own on public.anonymous_aliases;
drop policy if exists aliases_delete_own on public.anonymous_aliases;

create policy aliases_select_own on public.anonymous_aliases
  for select to authenticated
  using (exists (select 1 from public.participants p
                 where p.id = anonymous_aliases.participant_id and p.profile_id = auth.uid()));

create policy aliases_insert_own on public.anonymous_aliases
  for insert to authenticated
  with check (
    exists (select 1 from public.participants p
            where p.id = anonymous_aliases.participant_id and p.profile_id = auth.uid())
    and public.is_event_participant(event_id, auth.uid())
  );

create policy aliases_update_own on public.anonymous_aliases
  for update to authenticated
  using (exists (select 1 from public.participants p
                 where p.id = anonymous_aliases.participant_id and p.profile_id = auth.uid()))
  with check (exists (select 1 from public.participants p
                      where p.id = anonymous_aliases.participant_id and p.profile_id = auth.uid()));

create policy aliases_delete_own on public.anonymous_aliases
  for delete to authenticated
  using (exists (select 1 from public.participants p
                 where p.id = anonymous_aliases.participant_id and p.profile_id = auth.uid()));

-------------------------------------------------------------------------------
-- 2. event_members / assignments: restrict which columns clients may change
-------------------------------------------------------------------------------

-- Members (own row) and admins (any row, via RLS) may only edit names/emails.
-- event_id, participant_id, role, status and join_token are server-managed.
revoke all on table public.event_members from anon;
revoke insert, update, delete, truncate, references, trigger on table public.event_members from authenticated;
grant insert, delete on table public.event_members to authenticated;
grant update (display_name, anonymous_name, anonymous_email) on table public.event_members to authenticated;

-- Clients only ever insert their own membership (the admin row when creating
-- an event). Everyone else is added by the members-add / join-* edge functions,
-- so an admin can no longer force another user into an event as 'joined'.
drop policy if exists event_members_insert on public.event_members;
create policy event_members_insert on public.event_members
  for insert to authenticated
  with check (
    public.is_event_admin(event_id, auth.uid())
    and exists (select 1 from public.participants p
                where p.id = event_members.participant_id and p.profile_id = auth.uid())
  );

-- Givers may only flip first_reveal_pending on their own assignment.
-- Assignments are created/removed only by the draw function and reset_event_draw().
drop policy if exists assignments_update on public.assignments;
drop policy if exists assignments_insert on public.assignments;
drop policy if exists assignments_delete on public.assignments;
drop policy if exists assignments_update_own_reveal on public.assignments;
revoke all on table public.assignments from anon;
revoke insert, update, delete, truncate, references, trigger on table public.assignments from authenticated;
grant update (first_reveal_pending) on table public.assignments to authenticated;

create policy assignments_update_own_reveal on public.assignments
  for update to authenticated
  using (exists (select 1 from public.participants p
                 where p.id = assignments.giver_id and p.profile_id = auth.uid()))
  with check (exists (select 1 from public.participants p
                      where p.id = assignments.giver_id and p.profile_id = auth.uid()));

-- Unauthenticated callers could insert placeholder participants.
drop policy if exists participants_self_insert on public.participants;

-- No table needs anonymous (logged-out) access; every policy keys on auth.uid().
revoke all on all tables in schema public from anon;

-------------------------------------------------------------------------------
-- 3. SECURITY DEFINER functions: nothing callable without login,
--    internal helpers not callable by clients at all
-------------------------------------------------------------------------------

revoke execute on function public.audit_profile_access() from public, anon, authenticated;
revoke execute on function public.notify_assignment_completion() from public, anon, authenticated;
revoke execute on function public.prevent_blocked_email_signup() from public, anon, authenticated;
revoke execute on function public.fix_event_membership_duplicates(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.merge_duplicate_participants() from public, anon, authenticated;
revoke execute on function public.get_private_chat_unread_counts(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_or_get_join_token(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.generate_join_token() from public, anon, authenticated;
revoke execute on function public.get_user_email() from public, anon, authenticated;
revoke execute on function public.is_message_participant(uuid, uuid, uuid) from public, anon, authenticated;

-- Used by the app: logged-in users only.
revoke execute on function public.generate_join_code() from public, anon;
revoke execute on function public.get_event_member_display_info(uuid) from public, anon;
revoke execute on function public.list_event_members(uuid) from public, anon;
revoke execute on function public.remove_unjoined_participant(uuid, uuid) from public, anon;
revoke execute on function public.reset_event_draw(uuid) from public, anon;
revoke execute on function public.transfer_event_admin(uuid, uuid) from public, anon;
revoke execute on function public.update_profile_display_name(uuid, text) from public, anon;
revoke execute on function public.get_my_private_chats(uuid, jsonb) from public, anon;
revoke execute on function public.get_or_create_private_chat(uuid, uuid) from public, anon;

grant execute on function public.generate_join_code() to authenticated;
grant execute on function public.get_event_member_display_info(uuid) to authenticated;
grant execute on function public.list_event_members(uuid) to authenticated;
grant execute on function public.remove_unjoined_participant(uuid, uuid) to authenticated;
grant execute on function public.reset_event_draw(uuid) to authenticated;
grant execute on function public.transfer_event_admin(uuid, uuid) to authenticated;
grant execute on function public.update_profile_display_name(uuid, text) to authenticated;
grant execute on function public.get_my_private_chats(uuid, jsonb) to authenticated;
grant execute on function public.get_or_create_private_chat(uuid, uuid) to authenticated;

-- After a redraw, replace each giver's "you give to X" notification instead of
-- keeping the stale one from the previous draw.
create or replace function public.notify_assignment_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  event_record record;
  assignment_record record;
  giver_profile_id uuid;
  receiver_display_name text;
begin
  if coalesce(OLD.draw_status, '') <> 'completed' and NEW.draw_status = 'completed' then
    select name into event_record from public.events where id = NEW.id;

    delete from public.notifications
    where event_id = NEW.id and type = 'assignment';

    for assignment_record in
      select a.giver_id, a.receiver_id from public.assignments a where a.event_id = NEW.id
    loop
      select p.profile_id into giver_profile_id
      from public.participants p where p.id = assignment_record.giver_id;

      if giver_profile_id is not null and exists (select 1 from auth.users where id = giver_profile_id) then
        select pr.display_name into receiver_display_name
        from public.participants pa
        join public.profiles pr on pr.id = pa.profile_id
        where pa.id = assignment_record.receiver_id;

        insert into public.notifications (profile_id, type, title, body, event_id)
        values (
          giver_profile_id,
          'assignment',
          'Sorteggio completato!',
          format('Il sorteggio per "%s" è stato completato. Dovrai fare un regalo a %s!',
                 event_record.name, coalesce(receiver_display_name, 'qualcuno')),
          NEW.id
        );
      end if;
    end loop;
  end if;

  return NEW;
end;
$function$;

revoke execute on function public.notify_assignment_completion() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 4. Storage
-------------------------------------------------------------------------------

-- The event-images policies compared the event id against the *event name*
-- (unqualified `name` resolved to events.name), so uploads failed and the
-- object path was never checked. Qualify it as objects.name.
drop policy if exists "Event images: admin write" on storage.objects;
drop policy if exists "Event images: admin update" on storage.objects;
drop policy if exists "Event images: admin delete" on storage.objects;

create policy "Event images: admin write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and exists (select 1 from public.events e
                where e.id::text = (storage.foldername(objects.name))[1]
                  and e.admin_profile_id = auth.uid())
  );

create policy "Event images: admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-images'
    and exists (select 1 from public.events e
                where e.id::text = (storage.foldername(objects.name))[1]
                  and e.admin_profile_id = auth.uid())
  )
  with check (
    bucket_id = 'event-images'
    and exists (select 1 from public.events e
                where e.id::text = (storage.foldername(objects.name))[1]
                  and e.admin_profile_id = auth.uid())
  );

create policy "Event images: admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-images'
    and exists (select 1 from public.events e
                where e.id::text = (storage.foldername(objects.name))[1]
                  and e.admin_profile_id = auth.uid())
  );

-- Upserts (re-uploading avatar.webp / cover.webp) need SELECT on the object.
-- Scope it to the owner's folder so buckets still can't be listed.
drop policy if exists "Avatars: owner read" on storage.objects;
drop policy if exists "Event images: admin read" on storage.objects;
drop policy if exists "Wishlist images: owner read" on storage.objects;

create policy "Avatars: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(objects.name))[1] = auth.uid()::text);

create policy "Event images: admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-images'
    and exists (select 1 from public.events e
                where e.id::text = (storage.foldername(objects.name))[1]
                  and e.admin_profile_id = auth.uid())
  );

create policy "Wishlist images: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'wishlist-images' and (storage.foldername(objects.name))[1] = auth.uid()::text);

-- Public buckets: images only, 5 MB max.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'event-images', 'wishlist-images');

-------------------------------------------------------------------------------
-- 5. Wishlist links must be http(s). NOT VALID: existing rows are left alone,
--    new and updated rows are checked.
-------------------------------------------------------------------------------

alter table public.wishlist_items drop constraint if exists wishlist_items_url_scheme_chk;
alter table public.wishlist_items
  add constraint wishlist_items_url_scheme_chk
  check (
    (raw_url is null or raw_url ~* '^https?://')
    and (affiliate_url is null or affiliate_url ~* '^https?://')
  ) not valid;
