import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IdeasHeader } from "@/components/IdeasHeader";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { AdSlot } from "@/components/AdSlot";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Lightbulb, Search } from "lucide-react";
import { useI18n } from "@/i18n";

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

interface IdeasProps {
  showMobileFeed?: boolean;
}

export default function Ideas({ showMobileFeed = false }: IdeasProps) {
  const { t } = useI18n();
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
      // First, get the current user's participant ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per aggiungere prodotti alla lista");
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

      // Check if product already exists in wishlist
      const { data: existingItem } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('owner_id', participant.id)
        .eq('asin', product.asin)
        .maybeSingle();

      if (existingItem) {
        toast.error("Prodotto già presente nella tua lista desideri");
        return;
      }

      // Add to wishlist
      const { error } = await supabase
        .from('wishlist_items')
        .insert({
          owner_id: participant.id,
          asin: product.asin,
          title: product.title,
          image_url: product.image,
          price_snapshot: `${product.price} ${product.currency}`,
          affiliate_url: product.url,
          raw_url: product.url
        });

      if (error) throw error;

      toast.success("Prodotto aggiunto alla lista desideri! 🎁");
    } catch (error: unknown) {
      console.error('Error adding to wishlist:', error);
      toast.error("Errore nell'aggiungere il prodotto alla lista");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle py-6">
      <div className="container max-w-6xl">
        <PageHeader
          className="hidden"
          title={t('ideas.title') || "Idee Regalo"}
          description={t('ideas.description') || "Trova il regalo perfetto cercando su Amazon"}
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
            title={t('ideas.start_search') || "Inizia la ricerca"}
            description={t('ideas.search_hint') || "Usa le categorie sopra o cerca qualcosa di specifico per trovare idee regalo"}
          />
        ) : (
          <div className="space-y-6">
            <SectionHeader
              title={`Risultati per "${searchQuery}"`}
              description={searchResults ? `${searchResults.total} prodotti${searchResults.mock ? ' - dati di esempio' : ''}` : undefined}
            />
            
            {/* Mobile In-Feed Ad */}
            {showMobileFeed && (
              <div className="lg:hidden">
                <AdSlot 
                  id="ideas-mobile-feed" 
                  className="w-full mb-6"
                  placeholder="Contenuti sponsorizzati"
                />
              </div>
            )}
            
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
            <DialogTitle>{t('wishlist.choose_list') || "Scegli una lista"}</DialogTitle>
            <DialogDescription>
              {t('wishlist.choose_list_desc') || "Seleziona la lista desideri dove aggiungere il prodotto."}
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
              {t('common.cancel') || "Annulla"}
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
              {saving ? (t('common.adding') || 'Aggiungendo...') : (t('wishlist.add') || 'Aggiungi')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
