import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MemberWishlistItem, MemberWishlist } from "./useMemberWishlist";

export interface FullMemberWishlist extends MemberWishlist {
  items: MemberWishlistItem[];
}

export function useFullMemberWishlist(participantId: string | null, eventId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['full-member-wishlist', participantId, eventId],
    queryFn: async (): Promise<FullMemberWishlist | null> => {
      if (!participantId || !eventId) return null;

      // Fetch the wishlist for this participant in this event
      const { data: wishlist, error: wishlistError } = await supabase
        .from('wishlists')
        .select('id, title')
        .eq('owner_id', participantId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (wishlistError) {
        console.error('Error fetching member wishlist:', wishlistError);
        return null;
      }

      if (!wishlist) return null;

      // Fetch ALL items from this wishlist (no limit)
      const { data: items, error: itemsError } = await supabase
        .from('wishlist_items')
        .select('id, title, image_url, price_snapshot, affiliate_url, is_purchased')
        .eq('wishlist_id', wishlist.id)
        .order('created_at', { ascending: false });

      if (itemsError) {
        console.error('Error fetching wishlist items:', itemsError);
        return { ...wishlist, items: [] };
      }

      return {
        ...wishlist,
        items: items || []
      };
    },
    enabled: enabled && !!participantId && !!eventId,
    staleTime: 30000,
  });
}
