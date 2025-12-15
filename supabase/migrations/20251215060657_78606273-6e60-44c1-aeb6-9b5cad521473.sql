-- 1. Create an improved function to merge duplicate participants (handles wishlists properly)
CREATE OR REPLACE FUNCTION public.merge_duplicate_participants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  dup_record RECORD;
  canonical_pid uuid;
  duplicate_pids uuid[];
  total_merged int := 0;
  dup_wishlist_record RECORD;
  canonical_wishlist_id uuid;
BEGIN
  -- Find all profile_ids with multiple participants
  FOR dup_record IN 
    SELECT profile_id, array_agg(id ORDER BY created_at ASC) as pids
    FROM participants
    WHERE profile_id IS NOT NULL
    GROUP BY profile_id
    HAVING COUNT(*) > 1
  LOOP
    -- First one is canonical
    canonical_pid := dup_record.pids[1];
    duplicate_pids := dup_record.pids[2:];
    
    -- Handle wishlists specially - need to merge per event
    FOR dup_wishlist_record IN
      SELECT DISTINCT event_id FROM wishlists WHERE owner_id = ANY(duplicate_pids)
    LOOP
      -- Check if canonical already has a wishlist for this event
      SELECT id INTO canonical_wishlist_id
      FROM wishlists 
      WHERE event_id = dup_wishlist_record.event_id AND owner_id = canonical_pid;
      
      IF canonical_wishlist_id IS NOT NULL THEN
        -- Move items from duplicate wishlists to canonical, ignoring conflicts
        INSERT INTO wishlist_items (wishlist_id, event_id, owner_id, title, asin, raw_url, affiliate_url, image_url, price_snapshot, priority, notes, purchased_by, is_purchased, created_at)
        SELECT canonical_wishlist_id, wi.event_id, canonical_pid, wi.title, wi.asin, wi.raw_url, wi.affiliate_url, wi.image_url, wi.price_snapshot, wi.priority, wi.notes, wi.purchased_by, wi.is_purchased, wi.created_at
        FROM wishlist_items wi
        JOIN wishlists w ON w.id = wi.wishlist_id
        WHERE w.event_id = dup_wishlist_record.event_id AND w.owner_id = ANY(duplicate_pids)
        ON CONFLICT (wishlist_id, asin) DO NOTHING;
        
        -- Delete items from duplicate wishlists
        DELETE FROM wishlist_items WHERE wishlist_id IN (
          SELECT id FROM wishlists WHERE event_id = dup_wishlist_record.event_id AND owner_id = ANY(duplicate_pids)
        );
        
        -- Delete duplicate wishlists
        DELETE FROM wishlists WHERE event_id = dup_wishlist_record.event_id AND owner_id = ANY(duplicate_pids);
      ELSE
        -- No canonical wishlist - take the first duplicate's wishlist
        UPDATE wishlists SET owner_id = canonical_pid 
        WHERE event_id = dup_wishlist_record.event_id AND owner_id = duplicate_pids[1];
        
        UPDATE wishlist_items SET owner_id = canonical_pid 
        WHERE event_id = dup_wishlist_record.event_id AND owner_id = duplicate_pids[1];
        
        -- Handle remaining duplicates for same event
        IF array_length(duplicate_pids, 1) > 1 THEN
          DELETE FROM wishlist_items WHERE wishlist_id IN (
            SELECT id FROM wishlists WHERE event_id = dup_wishlist_record.event_id AND owner_id = ANY(duplicate_pids[2:])
          );
          DELETE FROM wishlists WHERE event_id = dup_wishlist_record.event_id AND owner_id = ANY(duplicate_pids[2:]);
        END IF;
      END IF;
    END LOOP;
    
    -- Now handle other references
    UPDATE event_members SET participant_id = canonical_pid WHERE participant_id = ANY(duplicate_pids);
    UPDATE assignments SET giver_id = canonical_pid WHERE giver_id = ANY(duplicate_pids);
    UPDATE assignments SET receiver_id = canonical_pid WHERE receiver_id = ANY(duplicate_pids);
    UPDATE exclusions SET giver_id = canonical_pid WHERE giver_id = ANY(duplicate_pids);
    UPDATE exclusions SET blocked_id = canonical_pid WHERE blocked_id = ANY(duplicate_pids);
    UPDATE wishlist_items SET purchased_by = canonical_pid WHERE purchased_by = ANY(duplicate_pids);
    UPDATE join_tokens SET participant_id = canonical_pid WHERE participant_id = ANY(duplicate_pids);
    UPDATE private_chats SET anonymous_participant_id = canonical_pid WHERE anonymous_participant_id = ANY(duplicate_pids);
    UPDATE private_chats SET exposed_participant_id = canonical_pid WHERE exposed_participant_id = ANY(duplicate_pids);
    UPDATE chat_messages SET author_participant_id = canonical_pid WHERE author_participant_id = ANY(duplicate_pids);
    UPDATE chat_messages SET recipient_participant_id = canonical_pid WHERE recipient_participant_id = ANY(duplicate_pids);
    UPDATE anonymous_aliases SET participant_id = canonical_pid WHERE participant_id = ANY(duplicate_pids);
    UPDATE notifications SET recipient_participant_id = canonical_pid WHERE recipient_participant_id = ANY(duplicate_pids);
    
    -- Delete duplicate participants
    DELETE FROM participants WHERE id = ANY(duplicate_pids);
    
    total_merged := total_merged + array_length(duplicate_pids, 1);
  END LOOP;
  
  RETURN jsonb_build_object('merged_count', total_merged);
END;
$$;

-- 2. Run the merge function
SELECT public.merge_duplicate_participants();

-- 3. Add unique constraint on profile_id
CREATE UNIQUE INDEX IF NOT EXISTS participants_profile_id_unique 
ON participants (profile_id) 
WHERE profile_id IS NOT NULL;

-- 4. Update RLS policy to allow members to update their own records
DROP POLICY IF EXISTS event_members_update ON event_members;

CREATE POLICY event_members_update ON event_members
FOR UPDATE USING (
  is_event_admin(event_id, auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.id = event_members.participant_id 
    AND p.profile_id = auth.uid()
  )
)
WITH CHECK (
  is_event_admin(event_id, auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.id = event_members.participant_id 
    AND p.profile_id = auth.uid()
  )
);