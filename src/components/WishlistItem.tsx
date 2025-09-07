import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ExternalLink, Trash2 } from "lucide-react";
import { withAffiliateTag } from "@/lib/amazon";
type WishlistItemData = {
  id: string;
  asin: string;
  title: string;
  image?: string;
  price?: number | null;
  currency?: string | null;
  url: string;
  lastUpdated?: string | null;
  wishlist_id: string;
};
interface Props {
  item: WishlistItemData;
  onDelete(id: string): Promise<void> | void;
  onAddManual(payload: { title: string; url: string }): Promise<void> | void;
  onOpenSearch(initialQuery: string): void;
  wishlistTitle?: string;
  eventTitle?: string;
}
export function WishlistItem({ item, onDelete, onAddManual, onOpenSearch, wishlistTitle, eventTitle }: Props) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmitManual = async () => {
    if (!manualUrl.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        title: manualTitle.trim() || item.title,
        url: withAffiliateTag(manualUrl.trim()),
      };
      await onAddManual(payload);
      setManualTitle("");
      setManualUrl("");
      setManualOpen(false);
    } finally {
      setSubmitting(false);
    }
  };
  const affiliateUrl = withAffiliateTag(item.url);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/placeholder.svg";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <h3 className="font-semibold leading-tight line-clamp-2">{item.title}</h3>
              {(wishlistTitle || eventTitle) && (
                <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                  {wishlistTitle}
                  {wishlistTitle && eventTitle ? ' • ' : ''}
                  {eventTitle}
                </div>
              )}
              {(item.price != null || item.currency) && (
                <div className="mt-1">
                  <Badge variant="secondary">
                    {item.price != null ? item.price : ""} {item.currency || ""}
                  </Badge>
                </div>
              )}
              {item.lastUpdated && (
                <div className="text-xs text-muted-foreground mt-1">
                  Prezzo aggiornato {new Date(item.lastUpdated).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center mb-2 justify-between">
              <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-primary focus:outline focus:ring-2 focus:ring-primary rounded px-1"
              aria-label="Vedi su Amazon"
              >
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" />
                Vedi su Amazon
              </span>
              </a>
              <div className="ml-auto">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(item.id)}
                aria-label="Rimuovi"
                className="min-h-[44px] text-red-90 hover:text-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Rimuovi
              </Button>
              </div>
            </div>
            {manualOpen && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`title-${item.id}`}>Titolo</Label>
                    <Input
                      id={`title-${item.id}`}
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Titolo del prodotto"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`url-${item.id}`}>URL Amazon</Label>
                    <Input
                      id={`url-${item.id}`}
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://www.amazon.it/dp/..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmitManual} disabled={submitting} className="flex-1">
                    Aggiungi
                  </Button>
                  <Button variant="outline" onClick={() => setManualOpen(false)} className="flex-1">
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default WishlistItem;
