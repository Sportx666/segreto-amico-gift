import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IdeasHeader } from "@/components/IdeasHeader";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";

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
      eco: "ecologico sostenibile"
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
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <IdeasHeader 
        onBucketClick={handleBucketClick}
        onCategoryClick={handleCategoryClick}
      />

      <SearchBar 
        onSearch={handleSearch}
        disabled={isLoading}
      />

      {isSearching && searchQuery && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Risultati per "{searchQuery}"
            {searchResults && (
              <span className="text-muted-foreground font-normal ml-2">
                ({searchResults.total} prodotti{searchResults.mock ? ' - dati di esempio' : ''})
              </span>
            )}
          </h2>
          
          <ProductsGrid
            products={searchResults?.items || []}
            loading={isLoading}
            onAddToWishlist={handleAddToWishlist}
          />
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
