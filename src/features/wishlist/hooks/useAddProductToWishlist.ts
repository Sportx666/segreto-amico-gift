/**
 * Hook for adding products to wishlist with proper error handling
 */
import { WishlistService, type Product } from '@/services/wishlist';
import { useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';

export function useAddProductToWishlist() {
  const { t } = useI18n();

  return useApiMutation(
    async ({ ownerId, wishlistId, eventId, product }: {
      ownerId: string;
      wishlistId: string;
      eventId?: string | null;
      product: Product;
    }) => {
      return WishlistService.addProductToWishlist(ownerId, wishlistId, eventId ?? null, product);
    },
    {
      onSuccess: () => {
        toast.success(t('toasts.product_added_list'));
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: t('toasts.add_product_to_list_error')
    }
  );
}
