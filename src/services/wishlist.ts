/**
 * Wishlist service - centralized wishlist operations
 */
import { supabase } from '@/integrations/supabase/client';
import { ApiService } from './api';
import { ParticipantService } from './participants';

export type Product = {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated?: string;
};

export type Wishlist = {
  id: string;
  title: string | null;
  notes: string | null;
  cover_image_url: string | null;
  created_at: string;
  owner_id: string;
  event_id: string | null;
};

export class WishlistService {
  /**
   * Get user's wishlists
   */
  static async getUserWishlists(userId: string): Promise<Wishlist[]> {
    const participantId = await ParticipantService.getOrCreateParticipantId(userId);
    
    const wishlists = await ApiService.supabaseQuery(
      'user_wishlists',
      async () => {
        const result = await supabase
          .from('wishlists')
          .select('*')
          .eq('owner_id', participantId)
          .order('created_at', { ascending: true });
        return result;
      }
    );
    return wishlists || [];
  }

  /**
   * Create a default wishlist for user
   */
  static async createDefaultWishlist(userId: string, title = 'La mia lista'): Promise<Wishlist> {
    const participantId = await ParticipantService.getOrCreateParticipantId(userId);
    
    return ApiService.supabaseQuery(
      'create_wishlist',
      async () => {
        const result = await supabase
          .from('wishlists')
          .insert({ owner_id: participantId, title })
          .select('*')
          .single();
        return result;
      }
    );
  }

  /**
   * Check if product already exists in wishlist
   */
  static async checkProductExists(ownerId: string, wishlistId: string | null, event_id:string|null, asin: string): Promise<boolean> {
    const query = supabase
      .from('wishlist_items')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('asin', asin)
      .eq('event_id', event_id);
    if (wishlistId) {
      query.eq('wishlist_id', wishlistId);
    }

    try {
      const item = await ApiService.supabaseQuery(
        'check_product_exists',
        async () => {
          const result = await query.maybeSingle();
          return result;
        }
      );
      return !!item;
    } catch {
      return false;
    }
  }

  /**
   * Add product to wishlist
   */
  static async addProductToWishlist(
    ownerId: string,
    wishlistId: string,
    event_id: string | null,
    product: Product
  ): Promise<void> {
    // Check for duplicates
    const exists = await this.checkProductExists(ownerId, wishlistId, event_id, product.asin);
    if (exists) {
      throw new Error('Prodotto già presente in questa lista');
    }

    await ApiService.supabaseQuery(
      'add_product_to_wishlist',
      async () => {
        const result = await supabase
          .from('wishlist_items')
          .insert({
            owner_id: ownerId,
            wishlist_id: wishlistId,
            event_id: event_id,
            asin: product.asin,
            title: product.title,
            image_url: product.image,
            price_snapshot: `${product.price} ${product.currency}`,
    raw_url: product.url,
    // Note: For catalog items, we store the direct Amazon URL without affiliate tags
    // affiliate_url will be set separately if needed
    affiliate_url: product.url.includes('/dp/') ? product.url : null,
          });
        return result;
      }
    );
  }

  /**
   * Add product to any user wishlist (creates default if none exist)
   */
  static async addProductForUser(userId: string, product: Product): Promise<void> {
    const participantId = await ParticipantService.getOrCreateParticipantId(userId);
    
    // Check if product already exists in any wishlist
    const exists = await this.checkProductExists(participantId, null, null, product.asin);
    if (exists) {
      throw new Error('Prodotto già presente nella tua lista desideri');
    }

    // Get or create wishlist
    let wishlists = await this.getUserWishlists(userId);
    
    if (wishlists.length === 0) {
      const defaultWishlist = await this.createDefaultWishlist(userId);
      wishlists = [defaultWishlist];
    }

    // Add to first wishlist
    await this.addProductToWishlist(participantId, wishlists[0].id, wishlists[0].event_id, product);
  }
}