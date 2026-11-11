import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProductsGrid } from "@/components/ProductsGrid";
import { CatalogService, catalogPageCount } from "@/services/catalog";
import { useI18n } from "@/i18n";

interface Product {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
}

interface CatalogSearchResultsProps {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  onAddToWishlist: (product: Product) => void;
  showSummary?: boolean;
}

export function CatalogSearchResults({
  query,
  minPrice,
  maxPrice,
  onAddToWishlist,
  showSummary = true,
}: CatalogSearchResultsProps) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, minPrice, maxPrice]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["catalog-search", query, page, minPrice ?? null, maxPrice ?? null],
    queryFn: () => CatalogService.searchProducts(query, page, minPrice, maxPrice),
    enabled: !!query.trim(),
    retry: false,
  });

  if (!query.trim()) return null;

  if (isError) {
    const message = error instanceof Error ? error.message : t("ideas.search_failed");
    return (
      <div className="text-center py-8 space-y-3" role="alert">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t("ideas.retry_search")}
        </Button>
      </div>
    );
  }

  const pageSize = data?.pageSize || 10;
  const pages = catalogPageCount(data?.total ?? 0, pageSize);
  const products = (data?.items || []).map((item) => CatalogService.catalogItemToProduct(item));

  return (
    <div className="space-y-4">
      {showSummary && data && (
        <p className="text-sm text-muted-foreground">
          {`${data.total} ${t("ideas.products_found")}${data.mock ? ` - ${t("ideas.sample_data")}` : ""}${data.fallback ? ` - ${t("ideas.service_unavailable")}` : ""}`}
        </p>
      )}
      <ProductsGrid
        products={products}
        loading={isLoading || isFetching}
        onAddToWishlist={onAddToWishlist}
      />
      {data && data.total > pageSize && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t("ideas.previous_page")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("ideas.page_status").replace("{page}", String(page)).replace("{pages}", String(pages))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("ideas.next_page")}
          </Button>
        </div>
      )}
    </div>
  );
}
