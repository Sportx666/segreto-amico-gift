import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { PriceFilter } from "@/components/PriceFilter";
import { ProductsGrid } from "@/components/ProductsGrid";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-grid";
import { Home, Search, SquarePen, Trash2, Plus, ExternalLink, Heart, Pencil, Check } from "lucide-react";
import { useI18n } from "@/i18n";
import { withAffiliateTag, productUrlFromASIN } from "@/lib/amazon";
import { WishlistItem } from "@/components/WishlistItem";
import { CatalogService } from "@/services/catalog";

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
  event_id?: string | null;
}

export default function Wishlist() {
  // Authentication guard - will redirect if not authenticated
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const { t } = useI18n();

  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [selectedWishlistTitle, setSelectedWishlistTitle] = useState<string | null>(null);
  const [targetWishlistIdForSearch, setTargetWishlistIdForSearch] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [manualFormData, setManualFormData] = useState({ title: "", url: "" });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [priceFilter, setPriceFilter] = useState<{min?: number, max?: number}>({});
  const [newListEventId, setNewListEventId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [isChooseWishlistOpen, setIsChooseWishlistOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  // Empty-state manual add form state
  const [emptyManualOpen, setEmptyManualOpen] = useState(false);
  const [emptyManualTitle, setEmptyManualTitle] = useState("");
  const [emptyManualUrl, setEmptyManualUrl] = useState("");
  const queryClient = useQueryClient();

  const { data: wishlists } = useQuery({
    queryKey: ["wishlists"],
    queryFn: async (): Promise<WishlistRow[]> => {
      if (!user) return [];

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (!participant) return [];

      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, event_id")
        .eq("owner_id", participant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ["wishlist-items", selectedWishlistId ?? "all"],
    queryFn: async (): Promise<WishlistItemRow[]> => {
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
    enabled: isAuthenticated,
  });

  const [isSearching, setIsSearching] = useState(false);
  const [triggerSearch, setTriggerSearch] = useState("");
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");

  const selectWishlist = (
    wishlistId: string | null,
    options?: { title?: string | null; eventId?: string | null }
  ) => {
    setSelectedWishlistId(wishlistId);

    if (wishlistId) {
      const wishlist = wishlists?.find((w) => w.id === wishlistId);
      const resolvedTitle = wishlist?.title ?? options?.title ?? null;
      const resolvedEventId = wishlist?.event_id ?? options?.eventId ?? null;

      setSelectedWishlistTitle(resolvedTitle);
      setCurrentEventId(resolvedEventId);
    } else {
      setSelectedWishlistTitle(null);
      setCurrentEventId(null);
    }
  };

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: [
      "catalog-search-wishlist",
      triggerSearch,
      priceFilter.min ?? null,
      priceFilter.max ?? null,
    ],
    queryFn: async () => {
      if (!triggerSearch)
        return { items: [], page: 1, pageSize: 10, total: 0, mock: true };

      const result = await CatalogService.searchProducts(triggerSearch,1 , priceFilter.min, priceFilter.max);
      // Convert CatalogItems to the expected format
      return {
        items: result.items.map(item => CatalogService.catalogItemToProduct(item)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        mock: result.mock
      };
    },
    enabled: !!triggerSearch && isSearchDialogOpen,
  });

  // Debounced search handler
  const handleDebouncedSearch = useCallback((query: string) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    const timer = setTimeout(() => {
      setTriggerSearch(query);
    }, 400);
    setSearchDebounceTimer(timer);
  }, [searchDebounceTimer]);

  const handlePriceFilter = (minPrice?: number, maxPrice?: number) => {
    setPriceFilter({ min: minPrice, max: maxPrice });
  };

  // Handle notes update
  const handleUpdateNotes = async (itemId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("wishlist_items")
        .update({ notes: notes.trim() || null })
        .eq("id", itemId);
      
      if (error) throw error;
      
      toast.success(t('wishlist.notes_saved'));
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      setEditingNotesId(null);
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error(t('wishlist.notes_error'));
    }
  };

  // Events available to the user (member of)
  interface EventRow { id: string; name: string }
  const { data: events } = useQuery({
    queryKey: ['events-for-wishlists'],
    queryFn: async (): Promise<EventRow[]> => {
      if (!user) return [];
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      if (!participant) return [];
      const { data: memberRows, error: membersErr } = await supabase
        .from('event_members')
        .select('event_id')
        .eq('participant_id', participant.id);
      if (membersErr) throw membersErr;
      const ids = (memberRows || []).map((r: any) => r.event_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('id, name')
        .in('id', ids);
      if (eventsErr) throw eventsErr;
      return (eventsData || []) as EventRow[];
    },
    enabled: isAuthenticated,
  });

  const addManualToWishlist = async (
    wishlistId: string,
    payload: { title: string; url: string }
  ) => {
    const url = payload.url.trim();
    if (!url) {
      toast.error(t('wishlist.invalid_url'));
      return;
    }

    try {
      if (!user) {
        toast.error(t('wishlist.not_authenticated'));
        return;
      }

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!participant) {
        toast.error(t('wishlist.participant_not_found'));
        return;
      }

      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      const asin = asinMatch ? asinMatch[1] : "";

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: wishlistId,
        event_id: currentEventId,
        asin: asin || null,
        title:
          payload.title ||
          (url.includes("amazon.")
            ? t('wishlist.manual_amazon_product')
            : t('wishlist.manual_product')),
        raw_url: url,
        affiliate_url: withAffiliateTag(url),
      });

      if (error) throw error;
      toast.success(t('wishlist.item_added'));
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error) {
      console.error("Error adding manual item:", error);
      toast.error(t('wishlist.item_add_error'));
    }
  };

  const handleEmptyManualSubmit = useCallback(async () => {
    if (!selectedWishlistId) {
      toast.error(t('wishlist.select_valid_list'));
      return;
    }

    const raw = emptyManualUrl.trim();
    if (!raw) {
      toast.error(t('wishlist.invalid_url'));
      return;
    }

    try {
      if (!user) {
        toast.error(t('wishlist.not_authenticated'));
        return;
      }

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!participant) {
        toast.error(t('wishlist.participant_not_found'));
        return;
      }

      const normalized = withAffiliateTag(raw);

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: selectedWishlistId,
        event_id: currentEventId,
        title: emptyManualTitle.trim() || (raw.includes("amazon.") ? t('wishlist.manual_amazon_product') : t('wishlist.manual_product')),
        raw_url: raw,
        affiliate_url: normalized,
      });

      if (error) {
        // Handle unique violation (e.g. duplicate link)
        if ((error as any)?.code === "23505") {
          toast.error(t('wishlist.item_duplicate'));
          return;
        }
        throw error;
      }

      toast.success(t('wishlist.item_added'));
      setEmptyManualTitle("");
      setEmptyManualUrl("");
      setEmptyManualOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (e) {
      console.error("handleEmptyManualSubmit error", e);
      toast.error(t('wishlist.item_add_error'));
    }
  }, [selectedWishlistId, emptyManualTitle, emptyManualUrl, t]);

  const handleAddFromSearch = async (product: Product) => {
    try {
      if (!user) {
        toast.error(t('wishlist.not_authenticated'));
        return;
      }

      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (!participant) {
        toast.error(t('wishlist.participant_not_found'));
        return;
      }

      if (!selectedWishlistId && !targetWishlistIdForSearch) {
        toast.error(t('wishlist.select_valid_list'));
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
        toast.error(t('wishlist.item_exists'));
        return;
      }

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: targetWishlistId,
        event_id: currentEventId,
        asin: product.asin,
        title: product.title,
        image_url: product.image,
        price_snapshot: `${product.price} ${product.currency}`,
        affiliate_url: withAffiliateTag(product.url),
        raw_url: product.url,
      });

      if (error) throw error;
      toast.success(t('wishlist.item_added'));
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error: unknown) {
      console.error("Error adding to wishlist:", error);
      toast.error(t('wishlist.item_add_error'));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast.success(t('wishlist.item_removed'));
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (error: unknown) {
      console.error("Error deleting item:", error);
      toast.error(t('wishlist.item_remove_error'));
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle py-6">
        <div className="container max-w-4xl">
          <div className="mb-8">
            <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
          <SkeletonGrid count={6} columns="2" />
        </div>
      </div>
    );
  }

  const hasWishlists = wishlists && wishlists.length > 0;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Home Button Bar - Between Navbar and Content */}
      <div className="container max-w-4xl py-2 md:py-3">
        <Button
          variant="ghost"
          onClick={() => window.location.href = '/'}
          className="text-muted-foreground hover:text-foreground"
        >
          <Home className="w-4 h-4 mr-2" />
          {t('buttons.home')}
        </Button>
      </div>

      <div className="container max-w-4xl pb-6">
        {/* Clean Header - Only "Nuova lista" button */}
        <PageHeader
          title={selectedWishlistTitle ?? t('wishlist.my_wishlists')}
          description={t('wishlist.manage_desc')}
        >
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('wishlist.new_list')}
          </Button>
        </PageHeader>

        {/* List selector with rename/delete actions */}
        {hasWishlists && (
          <div className="mb-6">
            <Label htmlFor="wishlist-select" className="text-sm font-medium mb-2 block">
              {t('wishlist.active_list')}
            </Label>

            <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto sm:overflow-visible">
              <Select
                value={selectedWishlistId || ""}
                onValueChange={(value) => {
                  selectWishlist(value);
                }}
              >
                <SelectTrigger id="wishlist-select" className="w-full sm:w-80">
                  <SelectValue placeholder={t('wishlist.select_list')} />
                </SelectTrigger>
                <SelectContent>
                  {wishlists?.map((wishlist) => {
                    const eventName = events?.find((e) => e.id === wishlist.event_id)?.name;
                    return (
                      <SelectItem key={wishlist.id} value={wishlist.id}>
                        {wishlist.title || t('wishlist.no_title')}
                        {eventName && (
                          <span className="text-muted-foreground ml-2">• {eventName}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {selectedWishlistId && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => {
                      const selectedWishlist = wishlists?.find(w => w.id === selectedWishlistId);
                      if (selectedWishlist) {
                        setEditTitle(selectedWishlist.title || "");
                        setEditEventId(selectedWishlist.event_id || null);
                        setIsEditDialogOpen(true);
                      }
                    }}
                  >
                    <SquarePen className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">{t('wishlist.change')}</span>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">{t('wishlist.remove')}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('wishlist.confirm_delete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('wishlist.delete_warning').replace('{title}', selectedWishlistTitle || '')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            if (!selectedWishlistId) return;
                            try {
                              // Delete all wishlist items first
                              const { error: itemsError } = await supabase
                                .from("wishlist_items")
                                .delete()
                                .eq("wishlist_id", selectedWishlistId);

                              if (itemsError) throw itemsError;

                              // Delete the wishlist
                              const { error: wishlistError } = await supabase
                                .from("wishlists")
                                .delete()
                                .eq("id", selectedWishlistId);

                              if (wishlistError) throw wishlistError;

                              // Reset selection
                              selectWishlist(null);

                              toast.success(t('wishlist.deleted_success'));
                              queryClient.invalidateQueries({ queryKey: ["wishlists"] });
                              queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
                            } catch (error) {
                              console.error("Error deleting wishlist:", error);
                              toast.error(t('wishlist.delete_error'));
                            }
                          }}
                        >
                          {t('common.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        )}


        {/* Main Content */}
        {!hasWishlists ? (
          <EmptyState
            title={t('wishlist.no_lists')}
            description={t('wishlist.no_lists_desc')}

          >
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('wishlist.create_first')}
            </Button>
          </EmptyState>
        ) : !selectedWishlistId ? (
          <EmptyState
            title={t('wishlist.select_list_hint')}
            description={t('wishlist.select_list_desc')}
          />
        ) : isLoading ? (
          <SkeletonGrid />
        ) : !wishlistItems?.length ? (
          <div className="space-y-6">
            {/* Manual add form for empty wishlist */}
            {activeItemId === "manual-add" && (
              <Card className="p-4 border-dashed border-2">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="empty-manual-title">{t('wishlist.product_title')}</Label>
                    <Input
                      id="empty-manual-title"
                      value={manualFormData.title}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={t('wishlist.product_title_placeholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="empty-manual-url">{t('wishlist.amazon_url')}</Label>
                    <Input
                      id="empty-manual-url"
                      value={manualFormData.url}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder={t('wishlist.amazon_url_placeholder')}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!selectedWishlistId) return;
                        await addManualToWishlist(selectedWishlistId, manualFormData);
                        setManualFormData({ title: '', url: '' });
                        setActiveItemId(null);
                      }}
                      disabled={!manualFormData.url.trim()}
                    >
                      {t('wishlist.add_to_list')}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        setActiveItemId(null);
                        setManualFormData({ title: '', url: '' });
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            
            <EmptyState
              icon={<Heart className="w-8 h-8 text-white" />}
              title={t('wishlist.no_products')}
              description={t('wishlist.add_products_desc')}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => {
                    if (!selectedWishlistId && wishlists?.length) {
                      selectWishlist(wishlists[0].id);
                      setTargetWishlistIdForSearch(wishlists[0].id);
                    } else {
                      setTargetWishlistIdForSearch(selectedWishlistId);
                    }
                    setIsSearchDialogOpen(true);
                  }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {t('wishlist.search_amazon')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedWishlistId && wishlists?.length) {
                      selectWishlist(wishlists[0].id);
                    }
                    setActiveItemId("manual-add");
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('wishlist.add_manually')}
                </Button>
              </div>
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Manual add form (when active) */}
            {activeItemId === "manual-add" && (
              <Card className="p-4 border-dashed border-2">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="manual-title">{t('wishlist.product_title')}</Label>
                    <Input
                      id="manual-title"
                      value={manualFormData.title}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={t('wishlist.product_title_placeholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-url">{t('wishlist.amazon_url')}</Label>
                    <Input
                      id="manual-url"
                      value={manualFormData.url}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder={t('wishlist.amazon_url_placeholder')}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!selectedWishlistId) return;
                        await addManualToWishlist(selectedWishlistId, manualFormData);
                        setManualFormData({ title: '', url: '' });
                        setActiveItemId(null);
                      }}
                      disabled={!manualFormData.url.trim()}
                    >
                      {t('wishlist.add_to_list')}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        setActiveItemId(null);
                        setManualFormData({ title: '', url: '' });
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Wishlist Items with Per-Item Actions */}
            {wishlistItems.map((item) => (
              <Card key={item.id} className="overflow-hidden shadow-card border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Item Image */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Heart className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2 mb-1">{item.title}</h3>
                      
                      {/* Notes display/edit */}
                      {editingNotesId === item.id ? (
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            value={editingNotesValue}
                            onChange={(e) => setEditingNotesValue(e.target.value)}
                            placeholder={t('wishlist.notes_placeholder')}
                            className="flex-1 h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateNotes(item.id, editingNotesValue);
                              } else if (e.key === 'Escape') {
                                setEditingNotesId(null);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleUpdateNotes(item.id, editingNotesValue)}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mb-2 group">
                          <p className="text-sm text-muted-foreground flex-1">
                            {item.notes || <span className="italic">{t('wishlist.no_notes')}</span>}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setEditingNotesId(item.id);
                              setEditingNotesValue(item.notes || "");
                            }}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                      
                      {item.price_snapshot && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.price_snapshot}
                        </p>
                      )}

                      {/* Per-Item Actions Cluster */}
                      <div className="flex flex-wrap gap-2">
                        {(item.affiliate_url || item.raw_url) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                          >
                            <a
                              href={item.affiliate_url || item.raw_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline">{t('wishlist.view_amazon')}</span>
                            </a>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Inline Manual Add Form */}
                      {activeItemId === item.id && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-3">
                          <div>
                            <Label htmlFor={`manual-title-${item.id}`}>{t('wishlist.product_title')}</Label>
                            <Input
                              id={`manual-title-${item.id}`}
                              value={manualFormData.title}
                              onChange={(e) => setManualFormData(prev => ({ ...prev, title: e.target.value }))}
                              placeholder={t('wishlist.product_title_placeholder')}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`manual-url-${item.id}`}>{t('wishlist.amazon_url')}</Label>
                            <Input
                              id={`manual-url-${item.id}`}
                              value={manualFormData.url}
                              onChange={(e) => setManualFormData(prev => ({ ...prev, url: e.target.value }))}
                              placeholder={t('wishlist.amazon_url_placeholder')}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                await addManualToWishlist(item.wishlist_id, manualFormData);
                                setManualFormData({ title: '', url: '' });
                                setActiveItemId(null);
                              }}
                              disabled={!manualFormData.url.trim()}
                            >
                              {t('common.add')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveItemId(null);
                                setManualFormData({ title: '', url: '' });
                              }}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Products Actions - moved here from list selector */}
            {selectedWishlistId && (
              <div className="mt-6 pt-4 border-t border-border/20">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      setTargetWishlistIdForSearch(selectedWishlistId);
                      setIsSearchDialogOpen(true);
                    }}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {t('wishlist.search_amazon')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveItemId("manual-add");
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('wishlist.add_manually')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclosure Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            {t('wishlist.affiliate_disclosure')}
          </p>
        </div>
      </div>

      {/* Centralized Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('wishlist.search_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('wishlist.search_dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <SearchBar 
                onSearch={(query) => {
                  setSearchQuery(query);
                  setTriggerSearch(query);
                }}
                disabled={isSearchLoading}
            />
            </div>
            <PriceFilter 
              value={priceFilter}
              onFilter={handlePriceFilter}
              disabled={isSearchLoading}
            />
          </div>
            {searchQuery && (
              <ProductsGrid
                products={searchResults?.items || []}
                loading={isSearchLoading}
                onAddToWishlist={handleAddFromSearch}
              />
            )}

        </DialogContent>
      </Dialog>

      {/* Create wishlist dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.new_list_dialog')}</DialogTitle>
            <DialogDescription>{t('wishlist.set_name_event')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-title">{t('wishlist.list_name')}</Label>
              <Input id="new-title" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder={t('wishlist.list_name_placeholder')} />
            </div>
            <div>
              <Label htmlFor="new-event">{t('wishlist.event_label')}</Label>
              <Select value={newListEventId ?? undefined} onValueChange={(v) => setNewListEventId(v)}>
                <SelectTrigger id="new-event"><SelectValue placeholder={t('wishlist.select_event')} /></SelectTrigger>
                <SelectContent>
                  {events?.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={async () => {
                if (!newListTitle.trim() || !newListEventId) { toast.error(t('wishlist.fill_name_event')); return; }
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { toast.error(t('wishlist.not_authenticated')); return; }
                  const { data: participant } = await supabase.from('participants').select('id').eq('profile_id', user.id).single();
                  if (!participant) { toast.error(t('wishlist.participant_not_found')); return; }
                  const { data: inserted, error } = await supabase
                    .from('wishlists')
                    .insert({ owner_id: participant.id, title: newListTitle.trim(), event_id: newListEventId })
                    .select('id,title,event_id')
                    .single();
                  if (error) throw error;
                  selectWishlist(inserted.id, { title: inserted.title ?? newListTitle.trim(), eventId: inserted.event_id ?? newListEventId });
                  setIsCreateDialogOpen(false);
                  setNewListTitle(''); setNewListEventId(null);
                  toast.success(t('wishlist.list_created'));
                  queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                  queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
                } catch (e) {
                  console.error(e); toast.error(t('wishlist.create_error'));
                }
              }}>{t('buttons.create')}</Button>
              <Button className="flex-1" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit wishlist dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.edit_list')}</DialogTitle>
            <DialogDescription>{t('wishlist.edit_list_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-title">{t('wishlist.list_name')}</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('wishlist.list_name_placeholder')} />
            </div>
            <div>
              <Label htmlFor="edit-event">{t('wishlist.event_label')}</Label>
              <Select value={editEventId ?? undefined} onValueChange={(v) => setEditEventId(v)}>
                <SelectTrigger id="edit-event"><SelectValue placeholder={t('wishlist.select_event')} /></SelectTrigger>
                <SelectContent>
                  {events?.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button className="flex-1" onClick={async () => {
                if (!selectedWishlistId) return;
                if (!editTitle.trim()) { toast.error(t('wishlist.fill_name_event')); return; }
                try {
                  const { error } = await supabase
                    .from('wishlists')
                    .update({ title: editTitle.trim(), event_id: editEventId ?? null })
                    .eq('id', selectedWishlistId);
                  if (error) throw error;
                  setSelectedWishlistTitle(editTitle.trim());
                  setIsEditDialogOpen(false);
                  toast.success(t('wishlist.updated_success'));
                  queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                } catch (e) {
                  console.error(e); toast.error(t('wishlist.update_error'));
                }
              }}>{t('common.save')}</Button>
              <Button className="flex-1" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Choose wishlist dialog for adding from ideas */}
      <Dialog open={isChooseWishlistOpen} onOpenChange={setIsChooseWishlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.choose_list')}</DialogTitle>
            <DialogDescription>{t('wishlist.choose_list_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedWishlistId ?? undefined} onValueChange={(v) => selectWishlist(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t('wishlist.select_list')} /></SelectTrigger>
              <SelectContent>
                {wishlists?.map((wl) => (
                  <SelectItem key={wl.id} value={wl.id}>{wl.title ?? t('wishlist.no_title')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!selectedWishlistId} onClick={() => selectedWishlistId && (async () => {
                // Confirm add pending
                const prod = pendingProduct; if (!prod) { setIsChooseWishlistOpen(false); return; }
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { toast.error(t('wishlist.not_authenticated')); return; }
                  const { data: participant } = await supabase.from('participants').select('id').eq('profile_id', user.id).single();
                  if (!participant) { toast.error(t('wishlist.participant_not_found')); return; }
                  const { data: existingItem } = await supabase
                    .from('wishlist_items').select('id')
                    .eq('wishlist_id', selectedWishlistId)
                    .eq('asin', prod.asin)
                    .maybeSingle();
                  if (existingItem) { toast.error(t('wishlist.item_exists')); return; }
                  const { error } = await supabase.from('wishlist_items').insert({
                    owner_id: participant.id,
                    wishlist_id: selectedWishlistId,
                    asin: prod.asin,
                    title: prod.title,
                    image_url: prod.image,
                    price_snapshot: `${prod.price} ${prod.currency}`,
                    affiliate_url: withAffiliateTag(prod.url),
                    raw_url: prod.url,
                  });
                  if (error) throw error;
                  toast.success(t('wishlist.item_added'));
                  queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
                } catch (e) { console.error(e); toast.error(t('wishlist.item_add_error')); }
                finally { setIsChooseWishlistOpen(false); setPendingProduct(null); }
              })()}>{t('common.save')}</Button>
              <Button className="flex-1" variant="outline" onClick={() => { setIsChooseWishlistOpen(false); setPendingProduct(null); }}>{t('common.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
