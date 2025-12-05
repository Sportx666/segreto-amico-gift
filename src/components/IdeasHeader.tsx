import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface IdeasHeaderProps {
  onBucketClick: (budget: number) => void;
  onCategoryClick: (category: string) => void;
}

const PRICE_BUCKETS = [5, 10, 20, 50] as const;
const CATEGORY_KEYS = ["office", "kitchen", "tech", "kids", "relax", "eco", "sports", "fashion"] as const;

export const IdeasHeader = ({ onBucketClick, onCategoryClick }: IdeasHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-6 mb-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('ideas.quick_ideas')}
        </h1>
        <p className="text-muted-foreground">
          {t('ideas.quick_ideas_desc')}
        </p>
      </div>

      {/* Price Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 justify-center">
        {PRICE_BUCKETS.map((budget) => (
          <Button
            key={budget}
            onClick={() => onBucketClick(budget)}
            variant="outline"
            className="h-16 text-lg font-semibold hover:bg-green-100 hover:border-green-300 dark:hover:bg-green-900/20"
          >
            {budget}€
          </Button>
        ))}
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
        {CATEGORY_KEYS.map((categoryKey) => (
          <Button
            key={categoryKey}
            onClick={() => onCategoryClick(categoryKey)}
            variant="secondary"
            size="sm"
            className="rounded-full text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
          >
            {t(`ideas.categories.${categoryKey}`)}
          </Button>
        ))}
      </div>
    </div>
  );
};
