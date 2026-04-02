import { useI18n } from '@/i18n';
import { GiftCategory } from '@/data/curatedGifts';
import { GiftProductCard } from './GiftProductCard';
import { useGiftCategoryProducts } from '@/hooks/useGiftCategoryProducts';
import { Skeleton } from '@/components/ui/skeleton';

interface GiftCategorySectionProps {
  category: GiftCategory;
}

const ProductSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="aspect-square w-full rounded-lg" />
    <Skeleton className="h-4 w-3/4" />
    <div className="flex justify-between items-center">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  </div>
);

export const GiftCategorySection = ({ category }: GiftCategorySectionProps) => {
  const { t } = useI18n();
  const { products, isLoading } = useGiftCategoryProducts(category);

  return (
    <section className="py-8" id={category.id}>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl" role="img" aria-hidden="true">
          {category.icon}
        </span>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t(category.titleKey)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(category.descriptionKey)}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
          : products.map((product) => (
              <GiftProductCard key={product.asin} product={product} />
            ))
        }
      </div>
    </section>
  );
};
