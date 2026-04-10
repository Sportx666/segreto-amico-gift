import { useQuery } from '@tanstack/react-query';
import { CatalogService } from '@/services/catalog';
import { withAffiliateTag } from '@/lib/amazon';
import { GiftCategory, CuratedProduct } from '@/data/curatedGifts';

export function useGiftCategoryProducts(category: GiftCategory) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gift-category', category.id, category.searchQuery],
    queryFn: async () => {
      const result = await CatalogService.searchProducts(
        category.searchQuery,
        1,
        category.minPrice,
        category.maxPrice
      );

      if (!result.items || result.items.length === 0) {
        return category.fallbackProducts;
      }

      // Client-side price filtering as safety net (API may not filter precisely)
      let filtered = result.items;
      if (category.maxPrice) {
        filtered = filtered.filter(item =>
          item.price != null && parseFloat(String(item.price)) <= category.maxPrice!
        );
      }
      if (category.minPrice) {
        filtered = filtered.filter(item =>
          item.price != null && parseFloat(String(item.price)) >= category.minPrice!
        );
      }

      if (filtered.length === 0) {
        return category.fallbackProducts;
      }

      // Map CatalogItem → CuratedProduct, applying affiliate tag as safety net
      return filtered.slice(0, 4).map((item): CuratedProduct => ({
        asin: item.asin || 'UNKNOWN',
        title: item.title,
        imageUrl: item.imageUrl || '',
        price: item.price
          ? `${item.currency === 'EUR' ? '€' : item.currency || '€'}${item.price}`
          : '',
        category: category.id,
        url: item.url ? withAffiliateTag(item.url) : undefined,
      }));
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    // On error, react-query will return undefined data; we handle fallback below
  });

  // Use fetched products or fall back to hardcoded ones
  const products = data && data.length > 0 ? data : category.fallbackProducts;

  return { products, isLoading, error };
}
