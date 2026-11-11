-- Redeem a join token in one transaction.
-- Not applied by this pull request.
--
-- Callable only by service_role. join-claim invokes it with the service-role
-- client after checking the caller's JWT.
--
-- Rollback (does not undo rows already redeemed):
--   DROP FUNCTION IF EXISTS public.claim_join_token(text, uuid);

CREATE OR REPLACE FUNCTION public.claim_join_token(_token text, _profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok public.join_tokens%ROWTYPE;
  slot_id uuid;
  slot_profile uuid;
  canonical_id uuid;
  prior_status text;
  member_id uuid;
  updated_count integer;
  already_member boolean := false;
  slot_list record;
  canon_list uuid;
BEGIN
  IF _token IS NULL OR length(trim(_token)) = 0 OR _profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  SELECT * INTO tok
  FROM public.join_tokens
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;
  IF tok.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'used');
  END IF;
  IF tok.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  slot_id := tok.participant_id;

  SELECT id INTO canonical_id
  FROM public.participants
  WHERE profile_id = _profile_id
  FOR UPDATE;

  IF slot_id IS NOT NULL THEN
    SELECT profile_id INTO slot_profile
    FROM public.participants
    WHERE id = slot_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'invalid');
    END IF;
    IF slot_profile IS NOT NULL AND slot_profile <> _profile_id THEN
      RETURN jsonb_build_object('error', 'forbidden');
    END IF;

    IF slot_profile = _profile_id THEN
      canonical_id := slot_id;
    ELSIF slot_profile IS NULL AND canonical_id IS NULL THEN
      BEGIN
        UPDATE public.participants
        SET profile_id = _profile_id
        WHERE id = slot_id AND profile_id IS NULL
        RETURNING id INTO canonical_id;
      EXCEPTION WHEN unique_violation THEN
        SELECT id INTO canonical_id
        FROM public.participants
        WHERE profile_id = _profile_id;
      END;

      IF canonical_id IS NULL THEN
        SELECT id INTO canonical_id
        FROM public.participants
        WHERE profile_id = _profile_id;
      END IF;
      IF canonical_id IS NULL THEN
        RAISE EXCEPTION 'participant_claim_failed';
      END IF;
    END IF;
  END IF;

  IF canonical_id IS NULL THEN
    BEGIN
      INSERT INTO public.participants (profile_id)
      VALUES (_profile_id)
      RETURNING id INTO canonical_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO canonical_id
      FROM public.participants
      WHERE profile_id = _profile_id;
    END;
    IF canonical_id IS NULL THEN
      RAISE EXCEPTION 'participant_claim_failed';
    END IF;
  END IF;

  SELECT status INTO prior_status
  FROM public.event_members
  WHERE event_id = tok.event_id AND participant_id = canonical_id;
  already_member := prior_status = 'joined';

  IF slot_id IS NOT NULL AND slot_id <> canonical_id THEN
    -- event_members (unique per event + participant)
    UPDATE public.event_members em
    SET participant_id = canonical_id
    WHERE em.participant_id = slot_id
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members c
        WHERE c.event_id = em.event_id AND c.participant_id = canonical_id
      );

    UPDATE public.event_members c
    SET status = 'joined'
    FROM public.event_members s
    WHERE s.participant_id = slot_id
      AND c.participant_id = canonical_id
      AND c.event_id = s.event_id
      AND s.status = 'joined';

    DELETE FROM public.event_members WHERE participant_id = slot_id;

    -- wishlists: move the list, or copy items when the canonical list exists
    FOR slot_list IN
      SELECT id, event_id FROM public.wishlists WHERE owner_id = slot_id
    LOOP
      SELECT id INTO canon_list
      FROM public.wishlists
      WHERE owner_id = canonical_id
        AND event_id IS NOT DISTINCT FROM slot_list.event_id
      LIMIT 1;

      IF canon_list IS NULL THEN
        UPDATE public.wishlists SET owner_id = canonical_id WHERE id = slot_list.id;
        UPDATE public.wishlist_items SET owner_id = canonical_id WHERE wishlist_id = slot_list.id;
      ELSE
        INSERT INTO public.wishlist_items (
          wishlist_id, event_id, owner_id, title, asin, raw_url, affiliate_url,
          image_url, price_snapshot, priority, notes, purchased_by, is_purchased, created_at
        )
        SELECT
          canon_list,
          event_id,
          canonical_id,
          title,
          asin,
          raw_url,
          affiliate_url,
          image_url,
          price_snapshot,
          priority,
          notes,
          CASE WHEN purchased_by = slot_id THEN canonical_id ELSE purchased_by END,
          is_purchased,
          created_at
        FROM public.wishlist_items
        WHERE wishlist_id = slot_list.id
        ON CONFLICT (wishlist_id, asin) DO NOTHING;

        DELETE FROM public.wishlist_items WHERE wishlist_id = slot_list.id;
        DELETE FROM public.wishlists WHERE id = slot_list.id;
      END IF;
    END LOOP;

    UPDATE public.wishlist_items SET owner_id = canonical_id WHERE owner_id = slot_id;
    UPDATE public.wishlist_items SET purchased_by = canonical_id WHERE purchased_by = slot_id;

    -- assignments (one giver and one receiver per event)
    UPDATE public.assignments a
    SET giver_id = canonical_id
    WHERE a.giver_id = slot_id
      AND NOT EXISTS (
        SELECT 1 FROM public.assignments c
        WHERE c.event_id = a.event_id AND c.giver_id = canonical_id
      );
    DELETE FROM public.assignments WHERE giver_id = slot_id;

    UPDATE public.assignments a
    SET receiver_id = canonical_id
    WHERE a.receiver_id = slot_id
      AND NOT EXISTS (
        SELECT 1 FROM public.assignments c
        WHERE c.event_id = a.event_id AND c.receiver_id = canonical_id
      );
    DELETE FROM public.assignments WHERE receiver_id = slot_id;
    DELETE FROM public.assignments
    WHERE giver_id = canonical_id AND receiver_id = canonical_id;

    -- exclusions, then drop a block that would point at itself
    DELETE FROM public.exclusions e
    USING public.exclusions c
    WHERE e.giver_id = slot_id
      AND c.giver_id = canonical_id
      AND c.event_id IS NOT DISTINCT FROM e.event_id
      AND c.blocked_id IS NOT DISTINCT FROM e.blocked_id
      AND e.id <> c.id;
    UPDATE public.exclusions SET giver_id = canonical_id WHERE giver_id = slot_id;

    DELETE FROM public.exclusions e
    USING public.exclusions c
    WHERE e.blocked_id = slot_id
      AND c.blocked_id = canonical_id
      AND c.giver_id IS NOT DISTINCT FROM e.giver_id
      AND c.event_id IS NOT DISTINCT FROM e.event_id
      AND e.id <> c.id;
    UPDATE public.exclusions SET blocked_id = canonical_id WHERE blocked_id = slot_id;
    DELETE FROM public.exclusions WHERE giver_id = blocked_id;

    UPDATE public.chat_messages
    SET author_participant_id = canonical_id
    WHERE author_participant_id = slot_id;
    UPDATE public.chat_messages
    SET recipient_participant_id = canonical_id
    WHERE recipient_participant_id = slot_id;

    DELETE FROM public.private_chats s
    USING public.private_chats c
    WHERE s.event_id = c.event_id
      AND s.id <> c.id
      AND s.anonymous_participant_id = slot_id
      AND c.anonymous_participant_id = canonical_id
      AND s.exposed_participant_id = c.exposed_participant_id;
    UPDATE public.private_chats
    SET anonymous_participant_id = canonical_id
    WHERE anonymous_participant_id = slot_id;

    DELETE FROM public.private_chats s
    USING public.private_chats c
    WHERE s.event_id = c.event_id
      AND s.id <> c.id
      AND s.exposed_participant_id = slot_id
      AND c.exposed_participant_id = canonical_id
      AND s.anonymous_participant_id = c.anonymous_participant_id;
    UPDATE public.private_chats
    SET exposed_participant_id = canonical_id
    WHERE exposed_participant_id = slot_id;
    DELETE FROM public.private_chats
    WHERE anonymous_participant_id = exposed_participant_id;

    DELETE FROM public.anonymous_aliases s
    USING public.anonymous_aliases c
    WHERE s.participant_id = slot_id
      AND c.participant_id = canonical_id
      AND s.event_id = c.event_id
      AND s.id <> c.id;
    UPDATE public.anonymous_aliases
    SET participant_id = canonical_id
    WHERE participant_id = slot_id;

    UPDATE public.notifications
    SET recipient_participant_id = canonical_id
    WHERE recipient_participant_id = slot_id;

    -- Every invite for this slot, including ones regenerated earlier.
    UPDATE public.join_tokens
    SET participant_id = canonical_id
    WHERE participant_id = slot_id;

    IF to_regclass('public.private_chat_names') IS NOT NULL THEN
      EXECUTE
        'DELETE FROM public.private_chat_names s
         USING public.private_chat_names c
         WHERE s.id <> c.id
           AND s.event_id = c.event_id
           AND s.participant_a_id = $1
           AND c.participant_a_id = $2
           AND s.participant_b_id = c.participant_b_id'
      USING slot_id, canonical_id;
      EXECUTE
        'UPDATE public.private_chat_names SET participant_a_id = $1 WHERE participant_a_id = $2'
      USING canonical_id, slot_id;
      EXECUTE
        'DELETE FROM public.private_chat_names s
         USING public.private_chat_names c
         WHERE s.id <> c.id
           AND s.event_id = c.event_id
           AND s.participant_b_id = $1
           AND c.participant_b_id = $2
           AND s.participant_a_id = c.participant_a_id'
      USING slot_id, canonical_id;
      EXECUTE
        'UPDATE public.private_chat_names SET participant_b_id = $1 WHERE participant_b_id = $2'
      USING canonical_id, slot_id;
      EXECUTE
        'DELETE FROM public.private_chat_names WHERE participant_a_id = participant_b_id';
    END IF;

    DELETE FROM public.participants WHERE id = slot_id;
  END IF;

  SELECT id, status INTO member_id, prior_status
  FROM public.event_members
  WHERE event_id = tok.event_id AND participant_id = canonical_id;

  IF member_id IS NULL THEN
    INSERT INTO public.event_members (event_id, participant_id, role, status)
    VALUES (tok.event_id, canonical_id, 'member', 'joined');
  ELSIF prior_status IS DISTINCT FROM 'joined' THEN
    UPDATE public.event_members SET status = 'joined' WHERE id = member_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.wishlists
    WHERE event_id = tok.event_id AND owner_id = canonical_id
  ) THEN
    INSERT INTO public.wishlists (event_id, owner_id, title)
    VALUES (tok.event_id, canonical_id, 'La mia lista');
  END IF;

  UPDATE public.join_tokens
  SET used_at = now()
  WHERE id = tok.id AND used_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'token_already_consumed';
  END IF;

  RETURN jsonb_build_object(
    'redirect', '/events/' || tok.event_id::text,
    'already_member', already_member,
    'participant_id', canonical_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_join_token(text, uuid) TO service_role;
