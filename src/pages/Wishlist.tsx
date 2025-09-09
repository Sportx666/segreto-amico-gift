import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-grid";
import { Search, SquarePen, Trash2, Plus, ExternalLink, Heart } from "lucide-react";
import { withAffiliateTag, productUrlFromASIN } from "@/lib/amazon";
import { WishlistItem } from "@/components/WishlistItem";
import { withDbTrace, classifyDbError } from "@/lib/dbTrace";

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
  owner_id: string;
}

export default function Wishlist() {
  const { user } = useAuth();
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [selectedWishlistTitle, setSelectedWishlistTitle] = useState<string | null>(null);
  const [targetWishlistIdForSearch, setTargetWishlistIdForSearch] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [manualFormData, setManualFormData] = useState({ title: "", url: "" });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListEventId, setNewListEventId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [isChooseWishlistOpen, setIsChooseWishlistOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  // Empty-state manual add form state
  const [emptyManualOpen, setEmptyManualOpen] = useState(false);
  const [emptyManualTitle, setEmptyManualTitle] = useState("");
  const [emptyManualUrl, setEmptyManualUrl] = useState("");
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Safe helper functions for create-then-add flow
  const getOrCreateParticipant = async (profileId: string): Promise<string> => {
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

  const getOrCreateDefaultWishlist = async (eventId: string, profileId: string): Promise<{ id: string; title: string }> => {
    const participantId = await getOrCreateParticipant(profileId);

    return await withDbTrace('wishlist:ensure', async () => {
      // Check if wishlist exists for this event/participant
      const { data: existing } = await supabase
        .from('wishlists')
        .select('id, title')
        .eq('event_id', eventId)
        .eq('owner_id', participantId)
        .maybeSingle();

      if (existing) return { id: existing.id, title: existing.title || 'La mia lista' };

      // Create default wishlist
      const { data: newWishlist, error } = await supabase
        .from('wishlists')
        .insert({
          event_id: eventId,
          owner_id: participantId,
          title: 'La mia lista'
        })
        .select('id, title')
        .single();

      if (error) throw error;
      return { id: newWishlist.id, title: newWishlist.title || 'La mia lista' };
    }, { table: 'wishlists', op: 'upsert', eventId, participantId });
  };

  const safeAddWishlistItem = async (params: {
    eventId?: string;
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
    try {
      let wishlistId = selectedWishlistId;

      // If no selected wishlist but we have an eventId, create default wishlist
      if (!wishlistId && params.eventId) {
        const wl = await getOrCreateDefaultWishlist(params.eventId, params.profileId);
        wishlistId = wl.id;
        // Refresh wishlists to show the new one
        queryClient.invalidateQueries({ queryKey: ["wishlists"] });
        setSelectedWishlistId(wishlistId);
        setSelectedWishlistTitle(wl.title);
      }

      if (!wishlistId) {
        toast.error("Seleziona un evento o crea una lista per aggiungere prodotti");
        return;
      }

      const participantId = await getOrCreateParticipant(params.profileId);

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

        toast.success("Aggiunto alla lista! 🎁");
        queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      }, { table: 'wishlist_items', op: 'insert', wishlistId });

    } catch (error) {
      console.error('Error in safeAddWishlistItem:', error);
      toast.error("Errore nell'aggiungere il prodotto alla lista");
    }
  };

  // Query for user's wishlists with performance guards
  const { data: wishlists } = useQuery({
    queryKey: ["wishlists"],
    queryFn: async (): Promise<WishlistRow[]> => {
      if (!user) return [];

      return await withDbTrace('wishlist:list', async () => {
        const participantId = await getOrCreateParticipant(user.id);

        const { data, error } = await supabase
          .from("wishlists")
          .select("id,title,event_id,owner_id")
          .eq("owner_id", participantId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return data || [];
      }, { table: 'wishlists', op: 'select', userId: user.id });
    },
    enabled: Boolean(user),
  });

  // Query wishlist items only when a list is selected
  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ["wishlist-items", selectedWishlistId],
    queryFn: async (): Promise<WishlistItemRow[]> => {
      if (!user || !selectedWishlistId) return [];

      return await withDbTrace('wishlist:items', async () => {
        const { data, error } = await supabase
          .from("wishlist_items")
          .select("id,wishlist_id,title,asin,affiliate_url,raw_url,image_url,price_snapshot,notes,created_at,is_purchased")
          .eq("wishlist_id", selectedWishlistId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      }, { table: 'wishlist_items', op: 'select', wishlistId: selectedWishlistId });
    },
    enabled: Boolean(user && selectedWishlistId),
  });

  // Amazon search (only when dialog is open)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["amazon-search-wishlist", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { items: [], page: 1, pageSize: 10, total: 0, mock: true };

      const response = await fetch("/api/amazon/search", {
        method: "POST",  
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery }),
      });

      if (!response.ok) throw new Error("Errore nella ricerca prodotti");
      return response.json();
    },
    enabled: !!searchQuery && isSearchDialogOpen,
  });

  // Events available to the user (member of)
  interface EventRow { id: string; name: string }
  const { data: events } = useQuery({
    queryKey: ['events-for-wishlists'],
    queryFn: async (): Promise<EventRow[]> => {
      if (!user) return [];

      return await withDbTrace('user:events', async () => {
        const participantId = await getOrCreateParticipant(user.id);

        const { data: memberRows, error: membersErr } = await supabase
          .from('event_members')
          .select('event_id')
          .eq('participant_id', participantId);

        if (membersErr) throw membersErr;

        const eventIds = (memberRows || []).map((r: any) => r.event_id).filter(Boolean);
        if (eventIds.length === 0) return [];

        const { data: eventsData, error: eventsErr } = await supabase
          .from('events')
          .select('id, name')
          .in('id', eventIds);

        if (eventsErr) throw eventsErr;
        return (eventsData || []) as EventRow[];
      }, { table: 'events', op: 'select', userId: user.id });
    },
    enabled: Boolean(user)
  });

  // Auto-select first wishlist if none selected
  useEffect(() => {
    if (!selectedWishlistId && wishlists && wishlists.length > 0) {
      const defaultList = wishlists.find(w => w.title === "La mia lista") || wishlists[0];
      setSelectedWishlistId(defaultList.id);
      setSelectedWishlistTitle(defaultList.title);
    }
  }, [wishlists, selectedWishlistId]);

  const addManualToWishlist = async (wishlistId: string, payload: { title: string; url: string }) => {
    if (!user) return;

    const url = payload.url.trim();
    if (!url) {
      toast.error("Inserisci un URL valido");
      return;
    }

    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch ? asinMatch[1] : "";

    await safeAddWishlistItem({
      profileId: user.id,
      item: {
        title: payload.title || (url.includes("amazon.") ? "Prodotto Amazon aggiunto manualmente" : "Prodotto aggiunto manualmente"),
        asin,
        raw_url: url,
        affiliate_url: withAffiliateTag(url),
      }
    });
  };

  const handleEmptyManualSubmit = useCallback(async () => {
    if (!user) return;

    const raw = emptyManualUrl.trim();
    if (!raw) {
      toast.error("Inserisci un URL valido");
      return;
    }

    await safeAddWishlistItem({
      eventId: currentEventId || undefined,
      profileId: user.id,
      item: {
        title: emptyManualTitle.trim() || (raw.includes("amazon.") ? "Prodotto Amazon aggiunto manualmente" : "Prodotto aggiunto manualmente"),
        raw_url: raw,
        affiliate_url: withAffiliateTag(raw),
      }
    });

    setEmptyManualTitle("");
    setEmptyManualUrl("");
    setEmptyManualOpen(false);
  }, [user, emptyManualTitle, emptyManualUrl, currentEventId]);

  const handleAddFromSearch = async (product: Product) => {
    if (!user) return;

    await safeAddWishlistItem({
      eventId: currentEventId || undefined,
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

    setIsSearchDialogOpen(false);
    setSearchQuery("");
  };

  const handleDeleteItem = async (itemId: string) => {
    await withDbTrace('wishlist:item-delete', async () => {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      
      toast.success("Prodotto rimosso dalla lista");
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    }, { table: 'wishlist_items', op: 'delete', itemId });
  };

  const handleDeleteWishlist = async (wishlistId: string) => {
    await withDbTrace('wishlist:delete', async () => {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("id", wishlistId);

      if (error) throw error;

      toast.success("Lista eliminata");
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
      
      if (selectedWishlistId === wishlistId) {
        setSelectedWishlistId(null);
        setSelectedWishlistTitle(null);
      }
    }, { table: 'wishlists', op: 'delete', wishlistId });
  };

  const handleCreateWishlist = async () => {
    if (!user || !newListTitle.trim()) return;

    try {
      const participantId = await getOrCreateParticipant(user.id);

      await withDbTrace('wishlist:create', async () => {
        const { data, error } = await supabase
          .from("wishlists")
          .insert({
            title: newListTitle.trim(),
            event_id: newListEventId,
            owner_id: participantId,
          })
          .select("id, title")
          .single();

        if (error) throw error;

        toast.success("Lista creata!");
        queryClient.invalidateQueries({ queryKey: ["wishlists"] });
        
        // Auto-select the new list
        setSelectedWishlistId(data.id);
        setSelectedWishlistTitle(data.title);
        
        setIsCreateDialogOpen(false);
        setNewListTitle("");
        setNewListEventId(null);
      }, { table: 'wishlists', op: 'create', title: newListTitle.trim() });
    } catch (error) {
      console.error("Error creating wishlist:", error);
      toast.error("Errore nella creazione della lista");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle py-6">
        <div className="container max-w-4xl">
          <EmptyState
            title="Accesso richiesto"
            description="Effettua l'accesso per gestire le tue liste desideri"
          >
            <Button onClick={() => window.location.href = '/auth'}>
              Accedi
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  const hasWishlists = wishlists && wishlists.length > 0;
  const hasItems = wishlistItems && wishlistItems.length > 0;

  return (
    <div className="min-h-screen bg-gradient-subtle py-6">
      <div className="container max-w-4xl">
        <PageHeader
          title="Liste Desideri"
          description="Gestisci i tuoi regali desiderati"
        />

        {/* Wishlist Action Button */}
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova lista
          </Button>
        </div>

        {/* Wishlist Selector */}
        {hasWishlists && (
          <div className="mb-6">
            <Label htmlFor="wishlist-select" className="text-sm font-medium mb-2 block">
              Lista attiva
            </Label>
            <Select
              value={selectedWishlistId || ""}
              onValueChange={(value) => {
                setSelectedWishlistId(value);
                const wishlist = wishlists?.find(w => w.id === value);
                setSelectedWishlistTitle(wishlist?.title || null);
                
                // Set current event for create-then-add flow
                setCurrentEventId(wishlist?.event_id || null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona una lista" />
              </SelectTrigger>
              <SelectContent>
                {wishlists?.map((wishlist) => {
                  const eventName = events?.find(e => e.id === wishlist.event_id)?.name;
                  return (
                    <SelectItem key={wishlist.id} value={wishlist.id}>
                      {wishlist.title || "Lista senza titolo"}
                      {eventName && (
                        <span className="text-muted-foreground ml-2">• {eventName}</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Create Wishlist Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea nuova lista</DialogTitle>
              <DialogDescription>
                Crea una nuova lista desideri per organizzare i tuoi regali
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-title">Nome lista</Label>
                <Input
                  id="list-title"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="La mia lista"
                />
              </div>
              <div>
                <Label htmlFor="list-event">Evento (opzionale)</Label>
                <Select value={newListEventId || ""} onValueChange={(value) => setNewListEventId(value || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona un evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessun evento</SelectItem>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateWishlist} className="flex-1">
                  Crea lista
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">
                  Annulla
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search Dialog */}
        <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Cerca prodotti su Amazon</DialogTitle>
              <DialogDescription>
                Trova prodotti da aggiungere alla tua lista desideri
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

        {/* Content */}
        {!hasWishlists ? (
          <EmptyState
            title="Nessuna lista presente"
            description="Crea una nuova lista per iniziare ad aggiungere i tuoi regali desiderati"
          >
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crea la tua prima lista
            </Button>
          </EmptyState>
        ) : !selectedWishlistId ? (
          <EmptyState
            title="Seleziona una lista"
            description="Scegli una lista dalle opzioni sopra per visualizzare i prodotti"
          />
        ) : isLoading ? (
          <SkeletonGrid />
        ) : !hasItems ? (
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
                      <Button className="flex-1" onClick={handleEmptyManualSubmit}>
                        Aggiungi alla lista
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setEmptyManualOpen(false)}>
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
              const wl = wishlists?.find(w => w.id === row.wishlist_id);
              const wlTitle = wl?.title ?? undefined;
              const evName = wl?.event_id ? (events?.find(e => e.id === wl.event_id)?.name) : undefined;
              const url = row.affiliate_url || row.raw_url || (row.asin ? productUrlFromASIN(row.asin, row.title) : "");
              
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
                  wishlistTitle={wlTitle || selectedWishlistTitle || undefined}
                  eventTitle={evName}
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
    </div>
  );
}