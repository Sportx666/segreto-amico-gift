import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberWishlistItem {
  id: string;
  title: string | null;
  image_url: string | null;
  price_snapshot: string | null;
  affiliate_url: string | null;
  is_purchased: boolean;
}

export interface MemberWishlist {
  id: string;
  title: string | null;
  items: MemberWishlistItem[];
}

export function useMemberWishlist(participantId: string | null, eventId: string | null) {
  return useQuery({
    queryKey: ['member-wishlist', participantId, eventId],
    queryFn: async (): Promise<MemberWishlist | null> => {
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

      // Fetch the first 3 items from this wishlist
      const { data: items, error: itemsError } = await supabase
        .from('wishlist_items')
        .select('id, title, image_url, price_snapshot, affiliate_url, is_purchased')
        .eq('wishlist_id', wishlist.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (itemsError) {
        console.error('Error fetching wishlist items:', itemsError);
        return { ...wishlist, items: [] };
      }

      return {
        ...wishlist,
        items: items || []
      };
    },
    enabled: !!participantId && !!eventId,
    staleTime: 30000, // 30 seconds
  });
}
