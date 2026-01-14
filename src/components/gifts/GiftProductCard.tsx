import { ExternalLink, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { CuratedProduct, getProductUrl } from '@/data/curatedGifts';

interface GiftProductCardProps {
  product: CuratedProduct;
}

export const GiftProductCard = ({ product }: GiftProductCardProps) => {
  const { t } = useI18n();
  const affiliateUrl = getProductUrl(product);

  const handleClick = () => {
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
      <div className="aspect-square relative overflow-hidden bg-muted/30">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] text-foreground">
          {product.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {product.price}
          </span>
          <Button 
            size="sm" 
            onClick={handleClick}
            className="gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{t('gift_guide.view_on_amazon')}</span>
            <ExternalLink className="w-3 h-3 sm:hidden" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
