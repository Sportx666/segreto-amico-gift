/**
 * Refactored Ideas page component with better separation of concerns
 */
import { useState } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { IdeasHeader } from "@/components/IdeasHeader";
import { SearchBar } from "@/components/SearchBar";
import { PriceFilter } from "@/components/PriceFilter";
import { CatalogSearchResults } from "@/components/CatalogSearchResults";
import { AdSlot } from "@/components/AdSlot";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductSelectionDialog } from "./ProductSelectionDialog";
import { Search, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAddProductForUser, useUserWishlists } from "@/features/wishlist/hooks/useWishlist";
import { type Product } from "@/services/wishlist";

interface IdeasPageProps {
  showMobileFeed?: boolean;
}

export default function IdeasPage({ showMobileFeed = false }: IdeasPageProps) {
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceFilter, setPriceFilter] = useState<{min?: number, max?: number}>({});
  
  // Hooks for wishlist operations
  const { data: wishlists = [] } = useUserWishlists();
  const addProductForUser = useAddProductForUser();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleBucketClick = (budget: number) => {
    const query = 'idee regalo';
    setSearchQuery(query);
    setPriceFilter({ min: undefined, max: budget });
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

  const handlePriceFilter = (minPrice?: number, maxPrice?: number) => {
    setPriceFilter({ min: minPrice, max: maxPrice });
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

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Auth guard will handle redirects, this won't be reached if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Home Button Bar - Between Navbar and Content */}
      <div className="container max-w-6xl py-2 md:py-3">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-muted-foreground hover:text-foreground"
        >
          <Home className="w-4 h-4 mr-2" />
          {t('buttons.home')}
        </Button>
      </div>
      
      <div className="container max-w-6xl pb-6">
        <PageHeader
          className="hidden"
          title={t('ideas.title') || "Idee Regalo"}
          description={t('ideas.description') || "Trova il regalo perfetto cercando su Amazon"}
        />
        
        <IdeasHeader 
          onBucketClick={handleBucketClick}
          onCategoryClick={handleCategoryClick}
        />

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1">
            <SearchBar 
              onSearch={handleSearch}
            />
          </div>
          <PriceFilter 
            value={priceFilter}
            onFilter={handlePriceFilter}
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
              title={`${t('ideas.results_for')} "${searchQuery}"${!priceFilter.max ? '' : ` - fino a €${priceFilter.max}`}`}
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
            
            <CatalogSearchResults
              query={searchQuery}
              minPrice={priceFilter.min}
              maxPrice={priceFilter.max}
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