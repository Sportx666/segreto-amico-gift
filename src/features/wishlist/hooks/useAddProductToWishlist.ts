/**
 * Hook for adding products to wishlist with proper error handling
 */
import { WishlistService, type Product } from '@/services/wishlist';
import { useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';

export function useAddProductToWishlist() {
  return useApiMutation(
    async ({ ownerId, wishlistId, product }: { 
      ownerId: string; 
      wishlistId: string; 
      product: Product; 
    }) => {
      return WishlistService.addProductToWishlist(ownerId, wishlistId, product);
    },
    {
      onSuccess: () => {
        toast.success('Prodotto aggiunto alla lista!');
      },
      invalidateQueries: [['user-wishlists']],
      errorMessage: "Errore nell'aggiunta del prodotto"
    }
  );
}