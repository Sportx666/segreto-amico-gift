/**
 * Wishlist-related hooks with proper error handling and caching
 */
import { useAuth } from '@/components/AuthProvider';
import { WishlistService, type Product, type Wishlist } from '@/services/wishlist';
import { useApiQuery, useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { useAddProductToWishlist } from './useAddProductToWishlist';
import { useI18n } from '@/i18n';

export { useAddProductToWishlist };

export function useUserWishlists() {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiQuery(
    ['user-wishlists', user?.id],
    async () => {
      if (!user) return [];
      return WishlistService.getUserWishlists(user.id);
    },
    {
      enabled: !!user,
      errorMessage: t('errors.loading_error')
    }
  );
}


export function useAddProductForUser() {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiMutation(
    (product: Product) => {
      if (!user) throw new Error('Authentication required');
      return WishlistService.addProductForUser(user.id, product);
    },
    {
      onSuccess: () => {
        toast.success(t('toasts.product_added_wishlist'));
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: t('toasts.add_product_error')
    }
  );
}

export function useCreateDefaultWishlist() {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiMutation(
    (title?: string) => {
      if (!user) throw new Error('Authentication required');
      return WishlistService.createDefaultWishlist(user.id, title);
    },
    {
      onSuccess: () => {
        toast.success(t('toasts.wishlist_created'));
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: t('toasts.create_wishlist_error')
    }
  );
}
