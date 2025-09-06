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
  SelectItem
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { Plus, Search, ExternalLink, Trash2 } from "lucide-react";
import { withAffiliateTag } from "@/lib/amazon";

type Product = {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
};

interface WishlistItem {
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
}

interface WishlistRow {
  id: string;
  title: string | null;
}

export default function Wishlist() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [selectedWishlistTitle, setSelectedWishlistTitle] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: wishlists } = useQuery({
    queryKey: ['wishlists'],
    queryFn: async (): Promise<WishlistRow[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!participant) return [];

      const { data, error } = await supabase
        .from('wishlists')
        .select('id, title')
        .eq('owner_id', participant.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch user's wishlist items
  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ['wishlist-items', selectedWishlistId ?? 'all'],
    queryFn: async (): Promise<WishlistItem[]> => {
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

  const handleAddManually = async () => {
    if (!manualUrl.trim()) {
      toast.error("Inserisci un URL valido");
      return;
    }

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

      // Extract ASIN from URL if it's an Amazon URL
      const asinMatch = manualUrl.match(/\/dp\/([A-Z0-9]{10})/);
      const asin = asinMatch ? asinMatch[1] : '';

      // Extract title from URL or use default
      const title = manualUrl.includes('amazon.') 
        ? "Prodotto Amazon aggiunto manualmente"
        : "Prodotto aggiunto manualmente";

      const { error } = await supabase
        .from('wishlist_items')
        .insert({
          owner_id: participant.id,
          wishlist_id: selectedWishlistId,
          asin: asin || null,
          title,
          raw_url: manualUrl,
          affiliate_url: withAffiliateTag(manualUrl)
        });

      if (error) throw error;

      toast.success("Prodotto aggiunto alla lista! 🎁");
      setManualUrl("");
      setIsAddDialogOpen(false);
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
        .eq('owner_id', participant.id)
        .eq('asin', product.asin)
        .maybeSingle();

      if (existingItem) {
        toast.error("Prodotto già presente nella tua lista");
        return;
      }

      // Add to wishlist
      const { error } = await supabase
        .from('wishlist_items')
        .insert({
          owner_id: participant.id,
          wishlist_id: selectedWishlistId,
          asin: product.asin,
          title: product.title,
          image_url: product.image,
          price_snapshot: `${product.price} ${product.currency}`,
          affiliate_url: product.url,
          raw_url: product.url
        });

      if (error) throw error;

      toast.success("Prodotto aggiunto alla lista! 🎁");
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
        <div className="flex gap-2">
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
                queryClient.invalidateQueries({ queryKey: ['wishlists'] });
              } catch (err) {
                console.error('Error creating wishlist', err);
                toast.error('Errore nella creazione della lista');
              }
            }}
          >
            Nuova lista
          </Button>
          <Select
            value={selectedWishlistId ?? 'all'}
            onValueChange={(val) => {
              if (val === 'all') {
                setSelectedWishlistId(null);
                setSelectedWishlistTitle(null);
              } else {
                setSelectedWishlistId(val);
                const wl = wishlists?.find(w => w.id === val);
                setSelectedWishlistTitle(wl?.title ?? 'La mia lista');
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
                  {wl.title ?? 'Senza titolo'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Cerca su Amazon
              </Button>
            </DialogTrigger>
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

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi manualmente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi prodotto manualmente</DialogTitle>
                <DialogDescription>
                  Incolla il link di un prodotto Amazon per aggiungerlo alla lista
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url">URL del prodotto</Label>
                  <Input
                    id="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://www.amazon.it/dp/..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddManually} className="flex-1">
                    Aggiungi alla lista
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {wishlistItems && wishlistItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎁</div>
          <h3 className="text-lg font-semibold mb-2">Lista desideri vuota</h3>
          <p className="text-muted-foreground mb-4">
            Inizia ad aggiungere prodotti che desideri ricevere
          </p>
          <Button onClick={() => setIsSearchDialogOpen(true)}>
            <Search className="w-4 h-4 mr-2" />
            Cerca su Amazon
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {wishlistItems?.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.svg';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-2 line-clamp-1">{item.title}</h3>
                    {item.price_snapshot && (
                      <Badge variant="secondary" className="mb-2">
                        {item.price_snapshot}
                      </Badge>
                    )}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mb-2">{item.notes}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {item.affiliate_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(item.affiliate_url!, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Vedi su Amazon
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Rimuovi
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
