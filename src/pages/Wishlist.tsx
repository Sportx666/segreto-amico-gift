import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { Search } from "lucide-react";
import { withAffiliateTag, productUrlFromASIN } from "@/lib/amazon";
import WishlistItem from "@/components/WishlistItem";

type Product = {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
};

interface WishlistItemRow {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  price_snapshot: string | null;
  affiliate_url: string | null;
  raw_url: string | null;
  notes: string | null;
  created_at: string;
  is_purchased: boolean;
  wishlist_id: string;
}

interface WishlistRow {
  id: string;
  title: string | null;
}

export default function Wishlist() {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [selectedWishlistTitle, setSelectedWishlistTitle] = useState<string | null>(null);
  const [targetWishlistIdForSearch, setTargetWishlistIdForSearch] = useState<string | null>(null);
  const [emptyManualOpen, setEmptyManualOpen] = useState(false);
  const [emptyManualTitle, setEmptyManualTitle] = useState("");
  const [emptyManualUrl, setEmptyManualUrl] = useState("");
  const queryClient = useQueryClient();

  const { data: wishlists } = useQuery({
    queryKey: ["wishlists"],
    queryFn: async (): Promise<WishlistRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (!participant) return [];

      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title")
        .eq("owner_id", participant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ["wishlist-items", selectedWishlistId ?? "all"],
    queryFn: async (): Promise<WishlistItemRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (!participant) throw new Error("Participant not found");

      let query = supabase
        .from("wishlist_items")
        .select("*")
        .eq("owner_id", participant.id)
        .order("created_at", { ascending: false });

      if (selectedWishlistId) {
        query = query.eq("wishlist_id", selectedWishlistId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["amazon-search-wishlist", searchQuery],
    queryFn: async () => {
      if (!searchQuery)
        return { items: [], page: 1, pageSize: 10, total: 0, mock: true };

      const response = await fetch("/api/amazon/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: searchQuery }),
      });

      if (!response.ok) {
        throw new Error("Errore nella ricerca prodotti");
      }

      return response.json();
    },
    enabled: !!searchQuery && isSearchDialogOpen,
  });

  const addManualToWishlist = async (
    wishlistId: string,
    payload: { title: string; url: string }
  ) => {
    const url = payload.url.trim();
    if (!url) {
      toast.error("Inserisci un URL valido");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!participant) {
        toast.error("Profilo partecipante non trovato");
        return;
      }

      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      const asin = asinMatch ? asinMatch[1] : "";

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: wishlistId,
        asin: asin || null,
        title:
          payload.title ||
          (url.includes("amazon.")
            ? "Prodotto Amazon aggiunto manualmente"
            : "Prodotto aggiunto manualmente"),
        raw_url: url,
        affiliate_url: withAffiliateTag(url),
      });

      if (error) throw error;
      toast.success("Prodotto aggiunto alla lista!");
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error) {
      console.error("Error adding manual item:", error);
      toast.error("Errore nell'aggiungere il prodotto");
    }
  };

  const handleAddFromSearch = async (product: Product) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (!participant) {
        toast.error("Profilo partecipante non trovato");
        return;
      }

      if (!selectedWishlistId && !targetWishlistIdForSearch) {
        toast.error("Seleziona una lista valida");
        return;
      }
      const targetWishlistId = targetWishlistIdForSearch ?? selectedWishlistId!;

      const { data: existingItem } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("wishlist_id", targetWishlistId)
        .eq("asin", product.asin)
        .maybeSingle();

      if (existingItem) {
        toast.error("Prodotto già presente nella lista");
        return;
      }

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: targetWishlistId,
        asin: product.asin,
        title: product.title,
        image_url: product.image,
        price_snapshot: `${product.price} ${product.currency}`,
        affiliate_url: withAffiliateTag(product.url),
        raw_url: product.url,
      });

      if (error) throw error;
      toast.success("Prodotto aggiunto alla lista!");
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error: unknown) {
      console.error("Error adding to wishlist:", error);
      toast.error("Errore nell'aggiungere il prodotto");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Prodotto rimosso dalla lista");
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error: unknown) {
      console.error("Error deleting item:", error);
      toast.error("Errore nella rimozione del prodotto");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {selectedWishlistTitle ?? "La mia lista desideri"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={async () => {
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                  toast.error("Devi essere autenticato");
                  return;
                }

                const { data: participant, error: pErr } = await supabase
                  .from("participants")
                  .select("id")
                  .eq("profile_id", user.id)
                  .single();
                if (pErr || !participant) {
                  toast.error("Profilo partecipante non trovato");
                  return;
                }

                const defaultTitle = "La mia lista";
                const { data: inserted, error } = await supabase
                  .from("wishlists")
                  .insert({ owner_id: participant.id, title: defaultTitle })
                  .select("id, title")
                  .single();

                if (error) throw error;

                setSelectedWishlistId(inserted.id);
                setSelectedWishlistTitle(inserted.title ?? defaultTitle);
                toast.success("Nuova lista creata");
                queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
                queryClient.invalidateQueries({ queryKey: ["wishlists"] });
              } catch (err) {
                console.error("Error creating wishlist", err);
                toast.error("Errore nella creazione della lista");
              }
            }}
          >
            Nuova lista
          </Button>
        </div>
      </div>

      {/* List selector beneath header */}
      <div className="mb-6">
        <Select
          value={selectedWishlistId ?? "all"}
          onValueChange={(val) => {
            if (val === "all") {
              setSelectedWishlistId(null);
              setSelectedWishlistTitle(null);
            } else {
              setSelectedWishlistId(val);
              const wl = wishlists?.find((w) => w.id === val);
              setSelectedWishlistTitle(wl?.title ?? "La mia lista");
            }
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tutte le liste" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le liste</SelectItem>
            {wishlists?.map((wl) => (
              <SelectItem key={wl.id} value={wl.id}>
                {wl.title ?? "Senza titolo"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Centralized Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cerca prodotti Amazon</DialogTitle>
            <DialogDescription>
              Trova prodotti su Amazon e aggiungili alla tua lista desideri
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SearchBar
              onSearch={setSearchQuery}
              disabled={isSearchLoading}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery && (
              <ProductsGrid
                products={searchResults?.items || []}
                loading={isSearchLoading}
                onAddToWishlist={handleAddFromSearch}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      {wishlistItems && wishlistItems.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🎁</div>
              <h3 className="text-lg font-semibold mb-2">Lista desideri vuota</h3>
              <p className="text-muted-foreground mb-6">
                Inizia ad aggiungere prodotti che desideri ricevere
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => {
                    if (!selectedWishlistId) {
                      toast.error("Seleziona o crea una lista");
                      return;
                    }
                    setTargetWishlistIdForSearch(selectedWishlistId);
                    setSearchQuery("");
                    setIsSearchDialogOpen(true);
                  }}
                  className="min-h-[44px]"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Cerca su Amazon
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEmptyManualOpen((v) => !v)}
                  className="min-h-[44px]"
                >
                  Aggiungi manualmente
                </Button>
              </div>

              {emptyManualOpen && (
                <div className="mt-6 max-w-xl mx-auto space-y-3 text-left">
                  <div>
                    <Label htmlFor="empty-title">Titolo</Label>
                    <Input
                      id="empty-title"
                      value={emptyManualTitle}
                      onChange={(e) => setEmptyManualTitle(e.target.value)}
                      placeholder="Titolo del prodotto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="empty-url">URL Amazon</Label>
                    <Input
                      id="empty-url"
                      value={emptyManualUrl}
                      onChange={(e) => setEmptyManualUrl(e.target.value)}
                      placeholder="https://www.amazon.it/dp/..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!selectedWishlistId) {
                          toast.error("Seleziona o crea una lista");
                          return;
                        }
                        await addManualToWishlist(selectedWishlistId, {
                          title: emptyManualTitle,
                          url: withAffiliateTag(emptyManualUrl),
                        });
                        setEmptyManualTitle("");
                        setEmptyManualUrl("");
                        setEmptyManualOpen(false);
                      }}
                    >
                      Aggiungi alla lista
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEmptyManualOpen(false)}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {wishlistItems?.map((row) => {
            const url =
              row.affiliate_url ||
              row.raw_url ||
              (row.asin ? productUrlFromASIN(row.asin, row.title) : "");
            return (
              <WishlistItem
                key={row.id}
                item={{
                  id: row.id,
                  asin: row.asin,
                  title: row.title,
                  image: row.image_url || undefined,
                  price: null,
                  currency: null,
                  url,
                  lastUpdated: null,
                  wishlist_id: row.wishlist_id,
                }}
                onDelete={async (id) => {
                  await handleDeleteItem(id);
                }}
                onAddManual={async (payload) => {
                  await addManualToWishlist(row.wishlist_id, payload);
                }}
                onOpenSearch={(initialQuery) => {
                  setTargetWishlistIdForSearch(row.wishlist_id);
                  setSearchQuery(initialQuery || "");
                  setIsSearchDialogOpen(true);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Disclosure Footer */}
      <div className="mt-12 pt-6 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Come affiliato Amazon, guadagniamo da acquisti idonei.
        </p>
      </div>
    </div>
  );
}

