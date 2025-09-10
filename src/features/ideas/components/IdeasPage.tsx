/**
 * Refactored Ideas page component with better separation of concerns
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IdeasHeader } from "@/components/IdeasHeader";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { AdSlot } from "@/components/AdSlot";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductSelectionDialog } from "./ProductSelectionDialog";
import { Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAddProductForUser, useUserWishlists } from "@/features/wishlist/hooks/useWishlist";
import { type Product } from "@/services/wishlist";
import { ApiService } from "@/services/api";

interface SearchResult {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  mock: boolean;
}

interface IdeasPageProps {
  showMobileFeed?: boolean;
}

export default function IdeasPage({ showMobileFeed = false }: IdeasPageProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Hooks for wishlist operations
  const { data: wishlists = [] } = useUserWishlists();
  const addProductForUser = useAddProductForUser();

  const searchProducts = async (query: string): Promise<SearchResult> => {
    if (!query) return { items: [], page: 1, pageSize: 10, total: 0, mock: true };
    
    return ApiService.fetchRequest<SearchResult>(
      'amazon_search',
      '/api/amazon/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      }
    );
  };

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['amazon-search', searchQuery],
    queryFn: () => searchProducts(searchQuery),
    enabled: !!searchQuery,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
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

  const handleAddToWishlist = (product: Product) => {
    if (wishlists.length === 0 || wishlists.length === 1) {
      // Auto-create and add, or add to single wishlist
      addProductForUser.mutate(product);
    } else {
      // Show selection dialog
      setSelectedProduct(product);
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
              onAddToWishlist={handleAddToWishlist}
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

      {/* Product Selection Dialog */}
      {selectedProduct && (
        <ProductSelectionDialog
          product={selectedProduct}
          wishlists={wishlists}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onConfirm={(wishlistId) => {
            if (selectedProduct) {
              addProductForUser.mutate(selectedProduct);
            }
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}