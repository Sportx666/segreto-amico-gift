import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { Plus, Search } from "lucide-react";
import { withAffiliateTag } from "@/lib/amazon";
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

export default function Wishlist() {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [selectedWishlistTitle, setSelectedWishlistTitle] = useState<string | null>(null);
  const [showEmptyManual, setShowEmptyManual] = useState(false);
  const [emptyTitle, setEmptyTitle] = useState("");
  const [emptyUrl, setEmptyUrl] = useState("");
  const queryClient = useQueryClient();

  // Fetch user's wishlist items
  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ['wishlist-items', selectedWishlistId ?? 'all'],
    queryFn: async (): Promise<WishlistItemRow[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get participant ID
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!participant) throw new Error("Participant not found");

      let query = supabase
        .from('wishlist_items')
        .select('*')
        .eq('owner_id', participant.id)
        .order('created_at', { ascending: false });

      if (selectedWishlistId) {
        query = query.eq('wishlist_id', selectedWishlistId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Search products from Amazon API
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['amazon-search-wishlist', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { items: [], page: 1, pageSize: 10, total: 0, mock: true };
      
      const response = await fetch('/api/amazon/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Errore nella ricerca prodotti');
      }

      return response.json();
    },
    enabled: !!searchQuery && isSearchDialogOpen,
  });

  const handleAddManual = async ({ title, url }: { title: string; url: string }) => {
    if (!url.trim()) {
      toast.error("Inserisci un URL valido");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!participant) {
        toast.error("Profilo partecipante non trovato");
        return;
      }

      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      const asin = asinMatch ? asinMatch[1] : null;

      if (asin) {
        const { data: existing } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('wishlist_id', selectedWishlistId)
          .eq('asin', asin)
          .maybeSingle();
        if (existing) {
          toast.error("Prodotto già presente nella lista");
          return;
        }
      }

      const finalUrl = withAffiliateTag(url);

      const { error } = await supabase
        .from('wishlist_items')
        .insert({
          owner_id: participant.id,
          wishlist_id: selectedWishlistId,
          asin: asin || null,
          title,
          raw_url: url,
          affiliate_url: finalUrl,
        });

      if (error) throw error;

      toast.success("Prodotto aggiunto alla lista! 🎁");
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    } catch (error: unknown) {
      console.error('Error adding manual item:', error);
      toast.error("Errore nell'aggiungere il prodotto");
    }
  };

  const handleAddFromSearch = async (product: Product) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      // Get participant ID
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!participant) {
        toast.error("Profilo partecipante non trovato");
        return;
      }

      // Check if product already exists
      const { data: existingItem } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('wishlist_id', selectedWishlistId)
        .eq('asin', product.asin)
        .maybeSingle();

      if (existingItem) {
        toast.error("Prodotto già presente nella tua lista");
        return;
      }

      // Add to wishlist
      const affiliateUrl = withAffiliateTag(product.url);
      const { error } = await supabase
        .from('wishlist_items')
        .insert({
          owner_id: participant.id,
          wishlist_id: selectedWishlistId,
          asin: product.asin,
          title: product.title,
          image_url: product.image,
          price_snapshot: `${product.price} ${product.currency}`,
          affiliate_url: affiliateUrl,
          raw_url: product.url,
        });

      if (error) throw error;

      toast.success("Prodotto aggiunto alla lista! 🎁");
      setIsSearchDialogOpen(false);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    } catch (error: unknown) {
      console.error('Error adding to wishlist:', error);
      toast.error("Errore nell'aggiungere il prodotto");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success("Prodotto rimosso dalla lista");
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    } catch (error: unknown) {
      console.error('Error deleting item:', error);
      toast.error("Errore nella rimozione del prodotto");
    }
  };

  const handleOpenSearch = (initialQuery: string) => {
    setSearchQuery(initialQuery);
    setIsSearchDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{selectedWishlistTitle ?? 'La mia lista desideri'}</h1>
        <Button
          variant="default"
          onClick={async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                toast.error("Devi essere autenticato");
                return;
              }

                const { data: participant, error: pErr } = await supabase
                  .from('participants')
                  .select('id')
                  .eq('profile_id', user.id)
                  .single();
                if (pErr || !participant) {
                  toast.error("Profilo partecipante non trovato");
                  return;
                }

                const defaultTitle = 'La mia lista';
                const { data: inserted, error } = await supabase
                  .from('wishlists')
                  .insert({ owner_id: participant.id, title: defaultTitle })
                  .select('id, title')
                  .single();

                if (error) throw error;

                setSelectedWishlistId(inserted.id);
                setSelectedWishlistTitle(inserted.title ?? defaultTitle);
                toast.success('Nuova lista creata');
                queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
              } catch (err) {
                console.error('Error creating wishlist', err);
                toast.error('Errore nella creazione della lista');
            }
          }}
          >
            Nuova lista
          </Button>
      </div>

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
              initialQuery={searchQuery}
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

      {wishlistItems && wishlistItems.length === 0 ? (
        <Card className="p-6 text-center">
          {showEmptyManual ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleAddManual({ title: emptyTitle, url: emptyUrl });
                setEmptyTitle("");
                setEmptyUrl("");
                setShowEmptyManual(false);
              }}
              className="space-y-2"
            >
              <div className="space-y-1 text-left">
                <Label htmlFor="empty-title">Titolo</Label>
                <Input
                  id="empty-title"
                  value={emptyTitle}
                  onChange={(e) => setEmptyTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1 text-left">
                <Label htmlFor="empty-url">URL Amazon</Label>
                <Input
                  id="empty-url"
                  value={emptyUrl}
                  onChange={(e) => setEmptyUrl(e.target.value)}
                  required
                  placeholder="https://www.amazon.it/dp/..."
                />
              </div>
              <Button type="submit" className="w-full">
                Aggiungi
              </Button>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="h-11" onClick={() => handleOpenSearch("")}>
                <Search className="w-4 h-4 mr-2" />
                Cerca su Amazon
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setShowEmptyManual(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi manualmente
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {wishlistItems?.map((item) => {
            const [price, currency] = item.price_snapshot
              ? item.price_snapshot.split(" ")
              : [null, null];
            return (
              <WishlistItem
                key={item.id}
                item={{
                  id: item.id,
                  asin: item.asin,
                  title: item.title,
                  image: item.image_url ?? undefined,
                  price: price ? parseFloat(price) : null,
                  currency: currency || null,
                  url: item.affiliate_url || item.raw_url || "",
                  lastUpdated: null,
                  wishlist_id: item.wishlist_id,
                }}
                onDelete={handleDeleteItem}
                onAddManual={handleAddManual}
                onOpenSearch={handleOpenSearch}
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
