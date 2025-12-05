-- Add RLS policies to allow event participants to view each other's wishlists
-- This enables the wishlist preview feature for joined members

-- Policy: Event participants can view wishlists of other joined participants in the same event
CREATE POLICY "wishlists_select_event_members" ON wishlists FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM event_members em1
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p ON p.id = em2.participant_id
    WHERE em1.participant_id = wishlists.owner_id
    AND em1.status = 'joined'
    AND em2.status = 'joined'
    AND p.profile_id = auth.uid()
    AND wishlists.event_id = em1.event_id
  )
);

-- Policy: Event participants can view wishlist items of other joined participants in the same event
CREATE POLICY "wishlist_items_select_event_members" ON wishlist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM wishlists w
    JOIN event_members em1 ON em1.participant_id = w.owner_id AND em1.event_id = w.event_id
    JOIN event_members em2 ON em2.event_id = em1.event_id
    JOIN participants p ON p.id = em2.participant_id
    WHERE w.id = wishlist_items.wishlist_id
    AND em1.status = 'joined'
    AND em2.status = 'joined'
    AND p.profile_id = auth.uid()
  )
);