import { Button } from "@/components/ui/button";
import { ideaBucketUrl } from "@/lib/amazon";

interface IdeasHeaderProps {
  onBucketClick: (budget: number) => void;
  onCategoryClick: (category: string) => void;
}

const PRICE_BUCKETS = [5, 10, 15, 20] as const;
const CATEGORIES = [
  { id: "ufficio", name: "Ufficio" },
  { id: "cucina", name: "Cucina" },
  { id: "tech", name: "Tech" },
  { id: "bambini", name: "Bambini" },
  { id: "relax", name: "Relax" },
  { id: "eco", name: "Eco" },
  { id: "sport", name: "Sport" },
  { id: "moda", name: "Moda" },
];

export const IdeasHeader = ({ onBucketClick, onCategoryClick }: IdeasHeaderProps) => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-6 mb-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          🎁 Idee regalo veloci
        </h1>
        <p className="text-muted-foreground">
          Trova il regalo perfetto senza uscire dalla pagina
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
      <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2 justify-center md:flex md:flex-wrap">
        {CATEGORIES.map((category) => (
          <Button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            variant="secondary"
            size="sm"
            className="rounded-full"
          >
            {category.name}
          </Button>
        ))}
      </div>
    </div>
  );
};