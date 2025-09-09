import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IdeasHeader } from "@/components/IdeasHeader";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Lightbulb, Search } from "lucide-react";

type Product = {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
};

interface SearchResult {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  mock: boolean;
}

export default function Ideas() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [wishlists, setWishlists] = useState<Array<{ id: string; title: string | null }>>([]);
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addProductToWishlist = async (ownerId: string, wishlistId: string, product: Product) => {
    // Check duplicate in selected wishlist
    const { data: existingItem } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('wishlist_id', wishlistId)
      .eq('asin', product.asin)
      .maybeSingle();
    if (existingItem) {
      toast.error('Prodotto già presente in questa lista');
      return;
    }
    const { error } = await supabase
      .from('wishlist_items')
      .insert({
        owner_id: ownerId,
        wishlist_id: wishlistId,
        asin: product.asin,
        title: product.title,
        image_url: product.image,
        price_snapshot: `${product.price} ${product.currency}`,
        affiliate_url: product.url,
        raw_url: product.url,
      });
    if (error) throw error;
    toast.success('Prodotto aggiunto alla lista!');
  };

  const handleAddToWishlistSelect = async (product: Product) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per aggiungere prodotti alla lista");
        return;
      }
      // Resolve participant id
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      if (!participant) {
        toast.error("Profilo partecipante non trovato");
        return;
      }

      // Load user's wishlists
      const { data: lists, error: wlErr } = await supabase
        .from('wishlists')
        .select('id, title')
        .eq('owner_id', participant.id)
        .order('created_at', { ascending: true });
      if (wlErr) throw wlErr;

      const all = lists ?? [];
      if (all.length === 0) {
        const { data: created, error: createErr } = await supabase
          .from('wishlists')
          .insert({ owner_id: participant.id, title: 'La mia lista' })
          .select('id, title')
          .single();
        if (createErr || !created) throw createErr ?? new Error('Creazione lista fallita');
        setWishlists([created]);
        setSelectedWishlistId(created.id);
        setPendingProduct(product);
        setChooseOpen(true);
        return;
      }

      if (all.length === 1) {
        await addProductToWishlist(participant.id, all[0].id, product);
        return;
      }

      setWishlists(all);
      setSelectedWishlistId(all[0].id);
      setPendingProduct(product);
      setChooseOpen(true);
    } catch (error: unknown) {
      console.error('Error adding to wishlist:', error);
      toast.error("Errore nell'aggiungere il prodotto alla lista");
    }
  };

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['amazon-search', searchQuery],
    queryFn: async (): Promise<SearchResult> => {
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
    enabled: !!searchQuery,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
  };

  const handleBucketClick = (budget: number) => {
    const query = `idee regalo sotto ${budget} euro`;
    handleSearch(query);
  };

  const handleCategoryClick = (category: string) => {
  const categoryNames: Record<string, string> = {
    ufficio: "ufficio lavoro",
    cucina: "cucina casa",
    tech: "tecnologia elettronica",
    bambini: "bambini giochi",
    relax: "relax benessere",
    eco: "ecologico sostenibile",
    sport: "sport fitness",
    moda: "moda accessori"
  };
    
    const query = `idee regalo ${categoryNames[category] || category}`;
    handleSearch(query);
  };

  const handleAddToWishlist = async (product: Product) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per aggiungere prodotti alla lista");
        return;
      }

      // Use safe add function - will create participant/wishlist if needed
      await safeAddWishlistItem({
        profileId: user.id,
        item: {
          title: product.title,
          asin: product.asin,
          image_url: product.image,
          price_snapshot: `${product.price} ${product.currency}`,
          affiliate_url: product.url,
          raw_url: product.url,
        }
      });
    } catch (error: unknown) {
      console.error('Error adding to wishlist:', error);
      toast.error("Errore nell'aggiungere il prodotto alla lista");
    }
  };

  // Safe helper for create-then-add flow
  const safeAddWishlistItem = async (params: {
    profileId: string;
    item: {
      title: string;
      asin?: string;
      affiliate_url?: string;
      raw_url?: string;
      image_url?: string;
      price_snapshot?: string;
    };
  }) => {
    const { withDbTrace, classifyDbError } = await import('@/lib/dbTrace');
    
    try {
      const participantId = await getOrCreateParticipant(params.profileId);
      
      // Check if already exists to avoid duplicates
      if (params.item.asin) {
        const { data: existing } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('owner_id', participantId)
          .eq('asin', params.item.asin)
          .maybeSingle();

        if (existing) {
          toast.error("Prodotto già presente nella tua lista desideri");
          return;
        }
      }

      // For /ideas, we add to the first available wishlist or create a default one
      let wishlistId: string | null = null;
      
      await withDbTrace('wishlist:find-or-create', async () => {
        // Try to find existing wishlist
        const { data: wishlists } = await supabase
          .from('wishlists')
          .select('id')
          .eq('owner_id', participantId)
          .limit(1);

        if (wishlists && wishlists.length > 0) {
          wishlistId = wishlists[0].id;
        } else {
          // Create a default wishlist
          const { data: newWishlist, error } = await supabase
            .from('wishlists')
            .insert({
              owner_id: participantId,
              title: 'La mia lista',
            })
            .select('id')
            .single();

          if (error) throw error;
          wishlistId = newWishlist.id;
        }
      }, { table: 'wishlists', op: 'find-or-create', participantId });

      if (!wishlistId) {
        toast.error("Errore nella creazione della lista");
        return;
      }

      await withDbTrace('wishlist:item-insert', async () => {
        const { error } = await supabase
          .from('wishlist_items')
          .insert({
            owner_id: participantId,
            wishlist_id: wishlistId,
            asin: params.item.asin || null,
            title: params.item.title,
            affiliate_url: params.item.affiliate_url || null,
            raw_url: params.item.raw_url || null,
            image_url: params.item.image_url || null,
            price_snapshot: params.item.price_snapshot || null,
          });

        if (error) {
          const kind = classifyDbError(error);
          if (kind.type === 'unique') {
            toast.error("Questo prodotto è già presente nella lista");
            return;
          }
          if (kind.type === 'rls' || kind.type === 'permission') {
            toast.error("Non hai i permessi per aggiungere prodotti a questa lista");
            return;
          }
          throw error;
        }

        toast.success("Prodotto aggiunto alla lista desideri! 🎁");
      }, { table: 'wishlist_items', op: 'insert', wishlistId });

    } catch (error) {
      console.error('Error in safeAddWishlistItem:', error);
      toast.error("Errore nell'aggiungere il prodotto alla lista");
    }
  };

  const getOrCreateParticipant = async (profileId: string): Promise<string> => {
    const { withDbTrace } = await import('@/lib/dbTrace');
    
    return await withDbTrace('participant:ensure', async () => {
      // Check if participant exists
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (existing) return existing.id;

      // Create participant
      const { data: newParticipant, error } = await supabase
        .from('participants')
        .insert({ profile_id: profileId })
        .select('id')
        .single();

      if (error) throw error;
      return newParticipant.id;
    }, { table: 'participants', op: 'upsert', profileId });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle py-6">
      <div className="container max-w-6xl">
        <PageHeader
          title="Idee Regalo"
          description="Trova il regalo perfetto cercando su Amazon"
        />
        
        <IdeasHeader 
          onBucketClick={handleBucketClick}
          onCategoryClick={handleCategoryClick}
        />

        <div className="mb-8">
          <SearchBar 
            onSearch={handleSearch}
            disabled={isLoading}
          />
        </div>

        {!searchQuery ? (
          <EmptyState
            icon={<Search className="w-8 h-8 text-white" />}
            title="Inizia la ricerca"
            description="Usa le categorie sopra o cerca qualcosa di specifico per trovare idee regalo"
          />
        ) : (
          <div className="space-y-6">
            <SectionHeader
              title={`Risultati per "${searchQuery}"`}
              description={searchResults ? `${searchResults.total} prodotti${searchResults.mock ? ' - dati di esempio' : ''}` : undefined}
            />
            
            <ProductsGrid
              products={searchResults?.items || []}
              loading={isLoading}
              onAddToWishlist={handleAddToWishlistSelect}
            />
          </div>
        )}

        {/* Disclosure Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Come affiliato Amazon, guadagniamo da acquisti idonei.
          </p>
        </div>
      </div>

      {/* Wishlist Selection Dialog */}
      <Dialog open={chooseOpen} onOpenChange={setChooseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scegli una lista</DialogTitle>
            <DialogDescription>
              Seleziona la lista desideri dove aggiungere il prodotto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedWishlistId ?? undefined} onValueChange={(v) => setSelectedWishlistId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli lista" />
              </SelectTrigger>
              <SelectContent>
                {wishlists.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.title || 'Senza titolo'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChooseOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={!selectedWishlistId || !pendingProduct || saving}
              onClick={async () => {
                if (!selectedWishlistId || !pendingProduct) return;
                try {
                  setSaving(true);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error('Non autenticato');
                  const { data: participant } = await supabase
                    .from('participants')
                    .select('id')
                    .eq('profile_id', user.id)
                    .single();
                  if (!participant) throw new Error('Partecipante non trovato');
                  await addProductToWishlist(participant.id, selectedWishlistId, pendingProduct);
                  setChooseOpen(false);
                  setPendingProduct(null);
                } catch (e) {
                  console.error(e);
                  toast.error("Errore nell'aggiunta alla lista");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Aggiungendo...' : 'Aggiungi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
