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
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/SearchBar";
import { ProductsGrid } from "@/components/ProductsGrid";
import { Search, SquarePen, Trash2 } from "lucide-react";
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
  const [emptyManualOpen, setEmptyManualOpen] = useState(false);
  const [emptyManualTitle, setEmptyManualTitle] = useState("");
  const [emptyManualUrl, setEmptyManualUrl] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListEventId, setNewListEventId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [isChooseWishlistOpen, setIsChooseWishlistOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
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

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["amazon-search-wishlist", searchQuery],
    queryFn: async () => {
      if (!searchQuery)
        return { items: [], page: 1, pageSize: 10, total: 0, mock: true };

      const response = await fetch("/api/amazon/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: searchQuery }),
      });

      if (!response.ok) {
        throw new Error("Errore nella ricerca prodotti");
      }

      return response.json();
    },
    enabled: !!searchQuery && isSearchDialogOpen,
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {selectedWishlistTitle ?? "Le mie liste dei desideri"}
        </h1>
        <div className="flex gap-2">
          <Button variant="default" onClick={() => setIsCreateDialogOpen(true)}>
            Nuova lista
          </Button>
        </div>
      </div>      

      {selectedWishlistId && emptyManualOpen && (
        <div className="mb-6 max-w-xl space-y-3">
          <div>
            <Label htmlFor="header-title">Titolo</Label>
            <Input id="header-title" value={emptyManualTitle} onChange={(e) => setEmptyManualTitle(e.target.value)} placeholder="Titolo del prodotto" />
          </div>
          <div>
            <Label htmlFor="header-url">URL Amazon</Label>
            <Input id="header-url" value={emptyManualUrl} onChange={(e) => setEmptyManualUrl(e.target.value)} placeholder="https://www.amazon.it/dp/..." />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={async () => { await addManualToWishlist(selectedWishlistId, { title: emptyManualTitle, url: withAffiliateTag(emptyManualUrl) }); setEmptyManualTitle(''); setEmptyManualUrl(''); setEmptyManualOpen(false); }}>Aggiungi alla lista</Button>
            <Button className="flex-1" variant="outline" onClick={() => setEmptyManualOpen(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {/* List selector beneath header */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <Select
          value={selectedWishlistId ?? "all"}
          onValueChange={(val) => {
            if (val === "all") {
              setSelectedWishlistId(null);
              setSelectedWishlistTitle(null);
            } else {
              setSelectedWishlistId(val);
              const wl = wishlists?.find((w) => w.id === val);
              setSelectedWishlistTitle(wl?.title ?? "La mia lista");
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
                {wl.title ?? "Senza titolo"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWishlistId && (
          <><Button size="sm" variant="outline" onClick={() => {
            setEditTitle(selectedWishlistTitle ?? '');
            setIsEditDialogOpen(true);
          } }><SquarePen className="w-4 h-4" />
          </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="text-red-90 hover:text-red-50" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa lista?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione non è reversibile. La lista e i suoi elementi collegati potrebbero non essere recuperabili.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      if (!selectedWishlistId) return;
                      try {
                        const { error } = await supabase
                          .from('wishlists')
                          .delete()
                          .eq('id', selectedWishlistId);
                        if (error) throw error;
                        setIsEditDialogOpen(false);
                        setSelectedWishlistId(null);
                        setSelectedWishlistTitle(null);
                        toast.success('Lista eliminata');
                        queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                        queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
                      } catch (e) { console.error(e); toast.error('Errore nell\'eliminare la lista'); }
                    }}
                  >
                    Elimina definitivamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog></>          
        )}
      {/* Under header actions (visible when a list is selected) */}
      {selectedWishlistId && wishlistItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <Button variant="outline" onClick={() => { setTargetWishlistIdForSearch(selectedWishlistId); setIsSearchDialogOpen(true); }}>
            <Search className="w-4 h-4" />
            <span className="hidden md:inline">Cerca su Amazon</span>
          </Button>
          <Button variant="default" onClick={() => setEmptyManualOpen((v) => !v)}>
            <SquarePen className="w-4 h-4 inline-flex md:hidden" />
            <span className="hidden md:inline">Aggiungi manualmente</span>
          </Button>
        </div>
      )}
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
              onSearch={setSearchQuery}
              disabled={isSearchLoading}
              value={searchQuery}
              onChangeText={setSearchQuery}
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


      {/* Content */}
      {wishlistItems && wishlistItems.length === 0 ? (
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
                    if (!selectedWishlistId) {
                      toast.error("Seleziona o crea una lista");
                      return;
                    }
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
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!selectedWishlistId) {
                          toast.error("Seleziona o crea una lista");
                          return;
                        }
                        await addManualToWishlist(selectedWishlistId, {
                          title: emptyManualTitle,
                          url: withAffiliateTag(emptyManualUrl),
                        });
                        setEmptyManualTitle("");
                        setEmptyManualUrl("");
                        setEmptyManualOpen(false);
                      }}
                    >
                      Aggiungi alla lista
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEmptyManualOpen(false)}
                    >
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
            const url =
              row.affiliate_url ||
              row.raw_url ||
              (row.asin ? productUrlFromASIN(row.asin, row.title) : "");
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
  );
}
