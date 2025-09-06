import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus, Clock } from "lucide-react";
import { withAffiliateTag } from "@/lib/amazon";

interface ProductCardProps {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
  onAdd: (product: {
    asin: string;
    title: string;
    image: string;
    price: number;
    currency: string;
    url: string;
  }) => void;
}

export const ProductCard = ({
  asin,
  title,
  image,
  price,
  currency,
  url,
  lastUpdated,
  onAdd
}: ProductCardProps) => {
  const handleAddToWishlist = () => {
    onAdd({
      asin,
      title,
      image,
      price,
      currency,
      url: withAffiliateTag(url)
    });
  };

  const handleViewOnAmazon = () => {
    window.open(withAffiliateTag(url), '_blank', 'noopener,noreferrer');
  };

  const formatLastUpdated = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Non disponibile';
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      <CardContent className="p-0">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder.svg';
            }}
          />
        </div>

        <div className="p-4 space-y-3">
          {/* Product Title */}
          <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
            {title}
          </h3>

          {/* Price */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-lg font-bold">
              {price.toFixed(2)} {currency}
            </Badge>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Aggiornato: {formatLastUpdated(lastUpdated)}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleAddToWishlist}
              className="w-full"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi alla lista
            </Button>
            
            <Button
              onClick={handleViewOnAmazon}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Vedi su Amazon
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};