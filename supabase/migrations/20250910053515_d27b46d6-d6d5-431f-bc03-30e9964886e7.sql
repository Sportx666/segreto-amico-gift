-- Create RPC function to fix event membership duplicates
CREATE OR REPLACE FUNCTION public.fix_event_membership_duplicates(_event_id uuid, _profile_id uuid) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical_pid uuid;
  duplicate_pids uuid[];
  memberships_before int;
  memberships_after int;
  canonical_wishlist_id uuid;
  dup_wishlist record;
BEGIN
  -- Count memberships before
  SELECT COUNT(DISTINCT em.participant_id) INTO memberships_before
  FROM event_members em 
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id AND p.profile_id = _profile_id;

  -- If only one membership, nothing to fix
  IF memberships_before <= 1 THEN
    RETURN jsonb_build_object(
      'memberships_before', memberships_before,
      'memberships_after', memberships_before,
      'canonical_participant_id', NULL,
      'merged_pids', '[]'::jsonb
    );
  END IF;

  -- Find all participant IDs for this profile in this event
  SELECT array_agg(em.participant_id ORDER BY em.created_at ASC) INTO duplicate_pids
  FROM event_members em 
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id AND p.profile_id = _profile_id;

  -- Pick first (oldest) as canonical
  canonical_pid := duplicate_pids[1];
  duplicate_pids := duplicate_pids[2:]; -- Remove canonical from duplicates array

  -- Move assignments (giver_id)
  UPDATE assignments SET giver_id = canonical_pid 
  WHERE event_id = _event_id AND giver_id = ANY(duplicate_pids);

  -- Move assignments (receiver_id)
  UPDATE assignments SET receiver_id = canonical_pid 
  WHERE event_id = _event_id AND receiver_id = ANY(duplicate_pids);

  -- Move exclusions (giver_id)
  UPDATE exclusions SET giver_id = canonical_pid 
  WHERE event_id = _event_id AND giver_id = ANY(duplicate_pids);

  -- Move exclusions (blocked_id)
  UPDATE exclusions SET blocked_id = canonical_pid 
  WHERE event_id = _event_id AND blocked_id = ANY(duplicate_pids);

  -- Handle wishlists: check if canonical already has one
  SELECT id INTO canonical_wishlist_id
  FROM wishlists 
  WHERE event_id = _event_id AND owner_id = canonical_pid;

  IF canonical_wishlist_id IS NOT NULL THEN
    -- Canonical has wishlist, move items from duplicates
    FOR dup_wishlist IN 
      SELECT id FROM wishlists 
      WHERE event_id = _event_id AND owner_id = ANY(duplicate_pids)
    LOOP
      -- Move items (with conflict handling)
      INSERT INTO wishlist_items (wishlist_id, event_id, owner_id, title, asin, raw_url, affiliate_url, image_url, price_snapshot, priority, notes, purchased_by, is_purchased, created_at)
      SELECT canonical_wishlist_id, event_id, canonical_pid, title, asin, raw_url, affiliate_url, image_url, price_snapshot, priority, notes, purchased_by, is_purchased, created_at
      FROM wishlist_items 
      WHERE wishlist_id = dup_wishlist.id
      ON CONFLICT (wishlist_id, asin) DO NOTHING;
      
      -- Delete duplicate wishlist items
      DELETE FROM wishlist_items WHERE wishlist_id = dup_wishlist.id;
      
      -- Delete duplicate wishlist
      DELETE FROM wishlists WHERE id = dup_wishlist.id;
    END LOOP;
  ELSE
    -- Canonical has no wishlist, reassign ownership of first duplicate's wishlist
    UPDATE wishlists SET owner_id = canonical_pid 
    WHERE event_id = _event_id AND owner_id = duplicate_pids[1];
    
    -- Update wishlist items ownership
    UPDATE wishlist_items SET owner_id = canonical_pid 
    WHERE event_id = _event_id AND owner_id = duplicate_pids[1];
    
    -- Delete remaining duplicate wishlists
    DELETE FROM wishlist_items 
    WHERE wishlist_id IN (
      SELECT id FROM wishlists 
      WHERE event_id = _event_id AND owner_id = ANY(duplicate_pids[2:])
    );
    DELETE FROM wishlists 
    WHERE event_id = _event_id AND owner_id = ANY(duplicate_pids[2:]);
  END IF;

  -- Update wishlist_items purchased_by references
  UPDATE wishlist_items SET purchased_by = canonical_pid 
  WHERE event_id = _event_id AND purchased_by = ANY(duplicate_pids);

  -- Update join_tokens participant_id references
  UPDATE join_tokens SET participant_id = canonical_pid 
  WHERE event_id = _event_id AND participant_id = ANY(duplicate_pids);

  -- Delete duplicate event_members
  DELETE FROM event_members 
  WHERE event_id = _event_id AND participant_id = ANY(duplicate_pids);

  -- Count memberships after
  SELECT COUNT(DISTINCT em.participant_id) INTO memberships_after
  FROM event_members em 
  JOIN participants p ON p.id = em.participant_id
  WHERE em.event_id = _event_id AND p.profile_id = _profile_id;

  RETURN jsonb_build_object(
    'memberships_before', memberships_before,
    'memberships_after', memberships_after,
    'canonical_participant_id', canonical_pid,
    'merged_pids', to_jsonb(duplicate_pids)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.fix_event_membership_duplicates TO authenticated;