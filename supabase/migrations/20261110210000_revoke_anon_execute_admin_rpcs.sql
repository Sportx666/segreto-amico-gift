-- Not applied by merging this pull request. Run it only after a separate
-- go-ahead, then smoke-test join by link/code, create event, draw reset,
-- chat unread counts, and profile. This file never references schema norbert.

-- Public SECURITY DEFINER functions are executable by anon through
-- /rest/v1/rpc when EXECUTE is granted to anon or to PUBLIC (the Postgres
-- default). Revoke those grants. Keep EXECUTE for authenticated only where
-- the current frontend calls the function. Everywhere else, keep service_role
-- only: unused RPCs, and RPCs called only by Edge Functions that use the
-- service-role client.
--
-- REVOKE FROM PUBLIC drops the default grant. Supabase also grants anon,
-- authenticated, and service_role explicitly, so each revoke is paired with
-- the GRANT that should remain. service_role is not a superuser and needs
-- that explicit GRANT.
--
-- Trigger functions: Postgres checks EXECUTE at CREATE TRIGGER time, not when
-- the trigger fires. Revoking API roles does not stop an existing trigger.

-- ---------------------------------------------------------------------------
-- A. Called by the signed-in frontend. Revoke anon + PUBLIC; keep authenticated.
-- ---------------------------------------------------------------------------

-- src/components/EventDraw.tsx. Function checks the caller is the event admin.
REVOKE ALL ON FUNCTION public.reset_event_draw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_event_draw(uuid) TO authenticated, service_role;

-- src/components/EventMembers.tsx. Function checks the caller is the event admin.
REVOKE ALL ON FUNCTION public.remove_unjoined_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_unjoined_participant(uuid, uuid) TO authenticated, service_role;

-- src/components/EventMembers.tsx. Function checks the caller is the event admin.
REVOKE ALL ON FUNCTION public.transfer_event_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_event_admin(uuid, uuid) TO authenticated, service_role;

-- src/pages/EventNew.tsx. Returns a random 6-character code and has no auth
-- check of its own; the page is signed-in. Anon does not need it.
REVOKE ALL ON FUNCTION public.generate_join_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_join_code() TO authenticated, service_role;

-- src/components/UserAssignment.tsx and YourAssignment.tsx. Raises if auth.uid() is null.
REVOKE ALL ON FUNCTION public.get_event_member_display_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_member_display_info(uuid) TO authenticated, service_role;

-- src/services/chatService.ts (useOptimizedPrivateChats passes the signed-in
-- user's participant id). The previous body did not check that auth.uid()
-- owns _participant_id, so any signed-in user who knew a participant id could
-- read unread counts. Require that ownership. service_role keeps a bypass
-- for maintenance; no Edge Function calls this RPC today.
CREATE OR REPLACE FUNCTION public.get_private_chat_unread_counts(
  _participant_id uuid,
  _event_id uuid,
  _last_read_timestamps jsonb
)
RETURNS TABLE(chat_id uuid, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.participants p
      WHERE p.id = _participant_id
        AND p.profile_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    pc.id AS chat_id,
    COUNT(cm.id)::bigint AS unread_count
  FROM private_chats pc
  LEFT JOIN chat_messages cm ON cm.private_chat_id = pc.id
    AND cm.author_participant_id != _participant_id
    AND (
      _last_read_timestamps IS NULL
      OR _last_read_timestamps ->> pc.id::text IS NULL
      OR cm.created_at > (_last_read_timestamps ->> pc.id::text)::timestamptz
    )
  WHERE pc.event_id = _event_id
    AND (
      pc.anonymous_participant_id = _participant_id
      OR pc.exposed_participant_id = _participant_id
    )
  GROUP BY pc.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_private_chat_unread_counts(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_private_chat_unread_counts(uuid, uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. No frontend caller. Service role only.
-- ---------------------------------------------------------------------------

-- Has an admin check. Not referenced by src/ or supabase/functions
-- (join links are created in the join-create Edge Function, not via this RPC).
REVOKE ALL ON FUNCTION public.create_or_get_join_token(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_join_token(uuid, uuid, integer) TO service_role;

-- Own-profile check. Profile.tsx updates public.profiles directly and does not call this.
REVOKE ALL ON FUNCTION public.update_profile_display_name(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_display_name(uuid, text) TO service_role;

-- Returns auth.users.email for auth.uid(). No frontend or Edge Function caller.
REVOKE ALL ON FUNCTION public.get_user_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email() TO service_role;

-- No authorization check. Rewrites participants, wishlists, and assignments.
-- Not called by the frontend or Edge Functions (only a one-shot SELECT in an older migration).
REVOKE ALL ON FUNCTION public.merge_duplicate_participants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_participants() TO service_role;

-- No authorization check. Called only by join-claim and join-event, both of
-- which create a service-role client. An explicit GRANT to authenticated in
-- 20250910053515 is removed here.
REVOKE ALL ON FUNCTION public.fix_event_membership_duplicates(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fix_event_membership_duplicates(uuid, uuid) TO service_role;

-- Called only from create_or_get_join_token, which runs as its owner.
-- Not a public RPC.
REVOKE ALL ON FUNCTION public.generate_join_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_join_token() TO service_role;

-- Present in src/integrations/supabase/types.ts as list_event_members(_event_id)
-- and not created by any file in supabase/migrations, and not called by src/
-- or supabase/functions. Lock it when the single-uuid function exists; abort
-- if an unexpected overload is present rather than guessing.
DO $do$
DECLARE
  arglist text;
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname = 'list_event_members';

  IF n = 0 THEN
    RAISE NOTICE 'public.list_event_members is absent; skip';
    RETURN;
  END IF;

  IF n <> 1 THEN
    RAISE EXCEPTION 'public.list_event_members has % overloads; refusing to guess a signature', n;
  END IF;

  SELECT pg_get_function_identity_arguments(p.oid) INTO arglist
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname = 'list_event_members';

  -- Accept only "uuid" or "<name> uuid" so format() cannot be fed arbitrary SQL.
  IF arglist !~ '^(uuid|[a-zA-Z_][a-zA-Z0-9_]* uuid)$' THEN
    RAISE EXCEPTION 'public.list_event_members identity arguments are "%", expected a single uuid', arglist;
  END IF;

  EXECUTE format(
    'REVOKE ALL ON FUNCTION public.list_event_members(%s) FROM PUBLIC, anon, authenticated',
    arglist
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.list_event_members(%s) TO service_role',
    arglist
  );
END
$do$;

-- ---------------------------------------------------------------------------
-- C. Trigger functions. Revoke API roles; firing an existing trigger does not
--    need EXECUTE.
-- ---------------------------------------------------------------------------

-- No supported trigger is attached (an earlier migration tried AFTER SELECT,
-- which Postgres rejects).
REVOKE ALL ON FUNCTION public.audit_profile_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_profile_access() TO service_role;

-- Trigger on public.events when draw_status becomes completed.
REVOKE ALL ON FUNCTION public.notify_assignment_completion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_assignment_completion() TO service_role;

-- BEFORE INSERT trigger on auth.users (blocked email signup).
REVOKE ALL ON FUNCTION public.prevent_blocked_email_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_blocked_email_signup() TO service_role;

-- ---------------------------------------------------------------------------
-- D. Former chat RLS helper.
--    chat_select_pair_messages was the only policy that called this, and
--    20251211035538 dropped that policy. Current pair policies join
--    private_chats instead. Confirm that old policy is gone before applying:
--    if it is still installed, this revoke makes that SELECT fail for
--    signed-in users.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.is_message_participant(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_message_participant(uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- E. Already locked down in earlier migrations. No change.
-- ---------------------------------------------------------------------------
-- public.get_event_member_emails(uuid)  -- anon/PUBLIC already revoked;
--                                        -- src/components/EventMembers.tsx
-- public.get_own_profile()               -- anon/PUBLIC already revoked;
--                                        -- src/pages/Profile.tsx
-- public.is_event_admin(uuid, uuid)      -- RLS helper; anon/PUBLIC already revoked
-- public.is_event_co_member(uuid, uuid)  -- RLS helper; anon/PUBLIC already revoked
-- public.is_event_member(uuid, uuid)     -- RLS helper; anon/PUBLIC already revoked
-- public.is_event_participant(uuid, uuid)-- RLS helper; anon/PUBLIC already revoked
-- public.is_profile_co_member(uuid, uuid)-- RLS helper; anon/PUBLIC already revoked
