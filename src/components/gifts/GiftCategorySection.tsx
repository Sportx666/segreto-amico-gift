import { useI18n } from '@/i18n';
import { GiftCategory } from '@/data/curatedGifts';
import { GiftProductCard } from './GiftProductCard';

interface GiftCategorySectionProps {
  category: GiftCategory;
}

export const GiftCategorySection = ({ category }: GiftCategorySectionProps) => {
  const { t } = useI18n();

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
        {category.products.map((product) => (
          <GiftProductCard key={product.asin} product={product} />
        ))}
      </div>
    </section>
  );
};
