import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  // Empty-state manual add form state
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
        .select("id, title, event_id")
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

  const [isSearching, setIsSearching] = useState(false);
  const [triggerSearch, setTriggerSearch] = useState("");

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["amazon-search-wishlist", triggerSearch],
    queryFn: async () => {
      if (!triggerSearch)
        return { items: [], page: 1, pageSize: 10, total: 0, mock: true };

      const response = await fetch("/api/amazon/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: triggerSearch }),
      });

      if (!response.ok) {
        throw new Error("Errore nella ricerca prodotti");
      }

      return response.json();
    },
    enabled: !!triggerSearch && isSearchDialogOpen,
  });

  // Events available to the user (member of)
  interface EventRow { id: string; name: string }
  const { data: events } = useQuery({
    queryKey: ['events-for-wishlists'],
    queryFn: async (): Promise<EventRow[]> => {
      const { data: { user } } = await supabase.auth.getUser();
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
    }
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

  const handleEmptyManualSubmit = useCallback(async () => {
    if (!selectedWishlistId) {
      toast.error("Seleziona o crea una lista");
      return;
    }

    const raw = emptyManualUrl.trim();
    if (!raw) {
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

      const normalized = withAffiliateTag(raw);

      const { error } = await supabase.from("wishlist_items").insert({
        owner_id: participant.id,
        wishlist_id: selectedWishlistId,
        title: emptyManualTitle.trim() || (raw.includes("amazon.") ? "Prodotto Amazon aggiunto manualmente" : "Prodotto aggiunto manualmente"),
        raw_url: raw,
        affiliate_url: normalized,
      });

      if (error) {
        // Handle unique violation (e.g. duplicate link)
        if ((error as any)?.code === "23505") {
          toast.error("Questo articolo è già presente nella lista");
          return;
        }
        throw error;
      }

      toast.success("Prodotto aggiunto alla lista!");
      setEmptyManualTitle("");
      setEmptyManualUrl("");
      setEmptyManualOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
    } catch (e) {
      console.error("handleEmptyManualSubmit error", e);
      toast.error("Errore nell'aggiungere il prodotto");
    }
  }, [selectedWishlistId, emptyManualTitle, emptyManualUrl]);

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
    <div className="min-h-screen bg-gradient-subtle py-6">
      <div className="container max-w-4xl">
        {/* Clean Header - Only "Nuova lista" button */}
        <PageHeader
          title={selectedWishlistTitle ?? "Le mie liste dei desideri"}
          description="Gestisci i tuoi prodotti desiderati"
        >
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova lista
          </Button>
        </PageHeader>

        {/* List selector */}
        {hasWishlists && (
          <div className="mb-6">
            <Label htmlFor="wishlist-select" className="text-sm font-medium mb-2 block">
              Lista attiva
            </Label>

            <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto sm:overflow-visible">
              <Select
                value={selectedWishlistId || ""}
                onValueChange={(value) => {
                  setSelectedWishlistId(value);
                  const wishlist = wishlists?.find((w) => w.id === value);
                  setSelectedWishlistTitle(wishlist?.title || null);

                  // Set current event for create-then-add flow
                  setCurrentEventId(wishlist?.event_id || null);
                }}
              >
                <SelectTrigger id="wishlist-select" className="w-full sm:w-80">
                  <SelectValue placeholder="Seleziona una lista" />
                </SelectTrigger>
                <SelectContent>
                  {wishlists?.map((wishlist) => {
                    const eventName = events?.find((e) => e.id === wishlist.event_id)?.name;
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

              {selectedWishlistId && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setIsSearchDialogOpen(true)}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Cerca su Amazon</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                  // onClick={() => setIsManualAddOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Aggiungi manualmente</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}


        {/* Main Content */}
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
        ) : !wishlistItems?.length ? (
          <EmptyState
            icon={<Heart className="w-8 h-8 text-white" />}
            title="Nessun prodotto nella lista"
            description="Aggiungi prodotti alla tua lista desideri"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => {
                  if (!selectedWishlistId && wishlists?.length) {
                    setSelectedWishlistId(wishlists[0].id);
                    setTargetWishlistIdForSearch(wishlists[0].id);
                  } else {
                    setTargetWishlistIdForSearch(selectedWishlistId);
                  }
                  setIsSearchDialogOpen(true);
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Cerca su Amazon
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedWishlistId && wishlists?.length) {
                    setSelectedWishlistId(wishlists[0].id);
                  }
                  setActiveItemId("manual-add");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi manualmente
              </Button>
            </div>
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {/* Manual add form (when active) */}
            {activeItemId === "manual-add" && (
              <Card className="p-4 border-dashed border-2">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="manual-title">Titolo</Label>
                    <Input
                      id="manual-title"
                      value={manualFormData.title}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Titolo del prodotto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-url">URL Amazon</Label>
                    <Input
                      id="manual-url"
                      value={manualFormData.url}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://www.amazon.it/dp/..."
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
                      Aggiungi alla lista
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        setActiveItemId(null);
                        setManualFormData({ title: '', url: '' });
                      }}
                    >
                      Annulla
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
                      <h3 className="font-medium line-clamp-2 mb-2">{item.title}</h3>
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
                              <span className="hidden sm:inline">Vedi su Amazon</span>
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
                            <Label htmlFor={`manual-title-${item.id}`}>Titolo</Label>
                            <Input
                              id={`manual-title-${item.id}`}
                              value={manualFormData.title}
                              onChange={(e) => setManualFormData(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Titolo del prodotto"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`manual-url-${item.id}`}>URL Amazon</Label>
                            <Input
                              id={`manual-url-${item.id}`}
                              value={manualFormData.url}
                              onChange={(e) => setManualFormData(prev => ({ ...prev, url: e.target.value }))}
                              placeholder="https://www.amazon.it/dp/..."
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
                              Aggiungi
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveItemId(null);
                                setManualFormData({ title: '', url: '' });
                              }}
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Disclosure Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Come affiliato Amazon, guadagniamo da acquisti idonei.
          </p>
        </div>
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
              onSearch={(query) => {
                setSearchQuery(query);
                setTriggerSearch(query);
              }}
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                // Only trigger search when user has typed at least 4 characters
                if (value.length >= 4) {
                  setTriggerSearch(value);
                } else if (value.length === 0) {
                  setTriggerSearch('');
                }
              }}
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

      {/* Create wishlist dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova lista</DialogTitle>
            <DialogDescription>Imposta nome ed evento collegato</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-title">Nome</Label>
              <Input id="new-title" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder="Nome lista" />
            </div>
            <div>
              <Label htmlFor="new-event">Evento</Label>
              <Select value={newListEventId ?? undefined} onValueChange={(v) => setNewListEventId(v)}>
                <SelectTrigger id="new-event"><SelectValue placeholder="Seleziona evento" /></SelectTrigger>
                <SelectContent>
                  {events?.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={async () => {
                if (!newListTitle.trim() || !newListEventId) { toast.error('Compila nome ed evento'); return; }
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { toast.error('Devi essere autenticato'); return; }
                  const { data: participant } = await supabase.from('participants').select('id').eq('profile_id', user.id).single();
                  if (!participant) { toast.error('Profilo partecipante non trovato'); return; }
                  const { data: inserted, error } = await supabase
                    .from('wishlists')
                    .insert({ owner_id: participant.id, title: newListTitle.trim(), event_id: newListEventId })
                    .select('id,title')
                    .single();
                  if (error) throw error;
                  setSelectedWishlistId(inserted.id);
                  setSelectedWishlistTitle(inserted.title ?? newListTitle.trim());
                  setIsCreateDialogOpen(false);
                  setNewListTitle(''); setNewListEventId(null);
                  toast.success('Nuova lista creata');
                  queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                  queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
                } catch (e) {
                  console.error(e); toast.error('Errore nella creazione della lista');
                }
              }}>Crea</Button>
              <Button className="flex-1" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annulla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit wishlist dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica lista</DialogTitle>
            <DialogDescription>Aggiorna nome ed evento; puoi anche eliminare la lista</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-title">Nome</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Nome lista" />
            </div>
            <div>
              <Label htmlFor="edit-event">Evento</Label>
              <Select value={editEventId ?? undefined} onValueChange={(v) => setEditEventId(v)}>
                <SelectTrigger id="edit-event"><SelectValue placeholder="Seleziona evento" /></SelectTrigger>
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
                if (!editTitle.trim()) { toast.error('Inserisci un nome'); return; }
                try {
                  const { error } = await supabase
                    .from('wishlists')
                    .update({ title: editTitle.trim(), event_id: editEventId ?? null })
                    .eq('id', selectedWishlistId);
                  if (error) throw error;
                  setSelectedWishlistTitle(editTitle.trim());
                  setIsEditDialogOpen(false);
                  toast.success('Lista aggiornata');
                  queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                } catch (e) {
                  console.error(e); toast.error('Errore nell\'aggiornare la lista');
                }
              }}>Salva</Button>
              <Button className="flex-1" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annulla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Choose wishlist dialog for adding from ideas */}
      <Dialog open={isChooseWishlistOpen} onOpenChange={setIsChooseWishlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scegli una lista</DialogTitle>
            <DialogDescription>Seleziona la lista a cui aggiungere l'articolo</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedWishlistId ?? undefined} onValueChange={(v) => setSelectedWishlistId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleziona lista" /></SelectTrigger>
              <SelectContent>
                {wishlists?.map((wl) => (
                  <SelectItem key={wl.id} value={wl.id}>{wl.title ?? 'Senza titolo'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!selectedWishlistId} onClick={() => selectedWishlistId && (async () => {
                // Confirm add pending
                const prod = pendingProduct; if (!prod) { setIsChooseWishlistOpen(false); return; }
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { toast.error('Devi essere autenticato'); return; }
                  const { data: participant } = await supabase.from('participants').select('id').eq('profile_id', user.id).single();
                  if (!participant) { toast.error('Profilo partecipante non trovato'); return; }
                  const { data: existingItem } = await supabase
                    .from('wishlist_items').select('id')
                    .eq('wishlist_id', selectedWishlistId)
                    .eq('asin', prod.asin)
                    .maybeSingle();
                  if (existingItem) { toast.error('Prodotto già presente nella lista'); return; }
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
                  toast.success('Prodotto aggiunto alla lista!');
                  queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
                } catch (e) { console.error(e); toast.error("Errore nell'aggiungere il prodotto"); }
                finally { setIsChooseWishlistOpen(false); setPendingProduct(null); }
              })()}>Conferma</Button>
              <Button className="flex-1" variant="outline" onClick={() => { setIsChooseWishlistOpen(false); setPendingProduct(null); }}>Annulla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
