import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Trash2 } from "lucide-react";
import { withAffiliateTag } from "@/lib/amazon";

interface WishlistItemProps {
  item: {
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
  onDelete(id: string): Promise<void>;
  onAddManual(payload: { title: string; url: string }): Promise<void>;
  onOpenSearch(initialQuery: string): void;
}

export function WishlistItem({
  item,
  onDelete,
  onAddManual,
  onOpenSearch,
}: WishlistItemProps) {
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddManual({ title, url: withAffiliateTag(url) });
    setTitle("");
    setUrl("");
    setShowManual(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="w-20 h-20 object-cover rounded-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1 line-clamp-2">{item.title}</h3>
            {item.price != null && item.currency && (
              <p className="text-sm mb-1">
                {item.price} {item.currency}
              </p>
            )}
            {item.lastUpdated && (
              <p className="text-xs text-muted-foreground mb-2">
                Prezzo aggiornato {item.lastUpdated}
              </p>
            )}
            {showManual && (
              <form onSubmit={handleManualSubmit} className="mt-4 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor={`title-${item.id}`}>Titolo</Label>
                  <Input
                    id={`title-${item.id}`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`url-${item.id}`}>URL Amazon</Label>
                  <Input
                    id={`url-${item.id}`}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    placeholder="https://www.amazon.it/dp/..."
                  />
                </div>
                <Button type="submit" className="w-full">
                  Aggiungi
                </Button>
              </form>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => onOpenSearch(item.title)}
            >
              <Search className="w-4 h-4 mr-2" />
              Cerca su Amazon
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setShowManual((s) => !s)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi manualmente
            </Button>
            <a
              href={withAffiliateTag(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-blue-600"
            >
              Vedi su Amazon
            </a>
            <Button
              variant="outline"
              className="h-11 text-red-600 hover:text-red-700"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Rimuovi
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default WishlistItem;
