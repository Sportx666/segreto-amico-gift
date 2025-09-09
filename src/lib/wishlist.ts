import { supabase } from "@/integrations/supabase/client";
import { withDbDebug } from "./dbDebug";
import { getOrCreateParticipantId } from "./participants";

export type Wishlist = {
  id: string;
  event_id: string;
  owner_id: string;
  title: string | null;
};

export type WishlistItem = {
  id: string;
  wishlist_id: string;
  title: string;
  asin: string | null;
  raw_url: string | null;
  affiliate_url: string | null;
  image_url: string | null;
  price_snapshot: string | null;
  created_at: string;
};

export async function getOrCreateDefaultWishlist(
  eventId: string,
  profileId: string,
): Promise<Wishlist> {
  return withDbDebug("wishlist:getOrCreateDefaultWishlist", async () => {
    const ownerId = await getOrCreateParticipantId(profileId);
    const existing = await supabase
      .from("wishlists")
      .select("id,event_id,owner_id,title")
      .eq("event_id", eventId)
      .eq("owner_id", ownerId)
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data as Wishlist;

    const inserted = await supabase
      .from("wishlists")
      .insert({ event_id: eventId, owner_id: ownerId, title: "La mia lista" })
      .select("id,event_id,owner_id,title")
      .single();
    if (inserted.error) throw inserted.error;
    return inserted.data as Wishlist;
  });
}

export async function safeAddWishlistItem(params: {
  eventId: string;
  profileId: string;
  item: {
    title: string;
    asin?: string | null;
    raw_url?: string | null;
    affiliate_url?: string | null;
    image_url?: string | null;
  };
}): Promise<{ ok: true; wishlist_id: string } | { ok: false; error: string; code?: string }> {
  return withDbDebug("wishlist:safeAddWishlistItem", async () => {
    try {
      const wishlist = await getOrCreateDefaultWishlist(
        params.eventId,
        params.profileId,
      );
      const { item } = params;
      const insert = await supabase
        .from("wishlist_items")
        .insert({
          wishlist_id: wishlist.id,
          title: item.title,
          asin: item.asin ?? null,
          raw_url: item.raw_url ?? null,
          affiliate_url: item.affiliate_url ?? null,
          image_url: item.image_url ?? null,
        })
        .select("id")
        .single();
      if (insert.error) {
        if (insert.error.code === "23505") {
          return { ok: false, error: "Già in lista", code: insert.error.code };
        }
        return { ok: false, error: insert.error.message, code: insert.error.code };
      }
      return { ok: true, wishlist_id: wishlist.id };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Errore", code: e?.code };
    }
  });
}
