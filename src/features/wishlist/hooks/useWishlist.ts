/**
 * Wishlist-related hooks with proper error handling and caching
 */
import { useAuth } from '@/components/AuthProvider';
import { WishlistService, type Product, type Wishlist } from '@/services/wishlist';
import { useApiQuery, useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { useAddProductToWishlist } from './useAddProductToWishlist';

export { useAddProductToWishlist };

export function useUserWishlists() {
  const { user } = useAuth();

  return useApiQuery(
    ['user-wishlists', user?.id],
    async () => {
      if (!user) return [];
      return WishlistService.getUserWishlists(user.id);
    },
    {
      enabled: !!user,
      errorMessage: "Errore nel caricamento delle liste desideri"
    }
  );
}


export function useAddProductForUser() {
  const { user } = useAuth();

  return useApiMutation(
    (product: Product) => {
      if (!user) throw new Error('Authentication required');
      return WishlistService.addProductForUser(user.id, product);
    },
    {
      onSuccess: () => {
        toast.success("Prodotto aggiunto alla lista desideri! 🎁");
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: "Errore nell'aggiunta del prodotto alla lista"
    }
  );
}

export function useCreateDefaultWishlist() {
  const { user } = useAuth();

  return useApiMutation(
    (title?: string) => {
      if (!user) throw new Error('Authentication required');
      return WishlistService.createDefaultWishlist(user.id, title);
    },
    {
      onSuccess: () => {
        toast.success('Lista desideri creata!');
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: "Errore nella creazione della lista"
    }
  );
}