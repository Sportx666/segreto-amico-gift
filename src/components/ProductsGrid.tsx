import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
}

interface ProductsGridProps {
  products: Product[];
  loading?: boolean;
  onAddToWishlist: (product: Product) => void;
}

const ProductSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="aspect-square w-full rounded-lg" />
    <div className="space-y-2 p-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  </div>
);

export const ProductsGrid = ({ products, loading = false, onAddToWishlist }: ProductsGridProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <ProductSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold mb-2">Nessun prodotto trovato</h3>
        <p className="text-muted-foreground">
          Prova con una ricerca diversa o esplora le categorie
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4">
      {products.map((product) => (
        <ProductCard
          key={`${product.asin}-${product.url}`}
          {...product}
          onAdd={onAddToWishlist}
        />
      ))}
    </div>
  );
};