/**
 * Catalog service - handles product search and details via pluggable providers
 */
import { ApiService } from './api';

export interface CatalogItem {
  title: string;
  imageUrl?: string;
  asin?: string;
  url: string;
  price?: string;
  currency?: string;
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  mock?: boolean;
  fallback?: boolean;
  provider?: string;
}

export interface CatalogItemResult {
  item: CatalogItem;
  mock?: boolean;
  fallback?: boolean;
  provider?: string;
}

export class CatalogService {
  /**
   * Search for products using the configured catalog provider
   */
  static async searchProducts(query: string, page: number = 1): Promise<CatalogSearchResult> {
    if (!query.trim()) {
      return { items: [], total: 0, page: 1, pageSize: 10 };
    }

    try {
      return await ApiService.fetchRequest<CatalogSearchResult>(
        'catalog_search',
        '/api/catalog/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, page }),
        }
      );
    } catch (error: any) {
      console.error('Catalog search error:', error);
      
      // Handle rate limiting gracefully
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        throw new Error('Troppe ricerche. Riprova tra qualche minuto.');
      }
      
      throw new Error('Errore durante la ricerca. Riprova più tardi.');
    }
  }

  /**
   * Get product details by ASIN
   */
  static async getProduct(asin: string): Promise<CatalogItemResult> {
    if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
      throw new Error('ASIN non valido');
    }

    try {
      return await ApiService.fetchRequest<CatalogItemResult>(
        'catalog_item',
        '/api/catalog/item',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asin }),
        }
      );
    } catch (error: any) {
      console.error('Catalog item error:', error);
      
      // Handle rate limiting gracefully
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        throw new Error('Troppe richieste. Riprova tra qualche minuto.');
      }
      
      throw new Error('Errore durante il caricamento del prodotto. Riprova più tardi.');
    }
  }

  /**
   * Convert CatalogItem to Product format for wishlist compatibility
   */
  static catalogItemToProduct(catalogItem: CatalogItem): {
    asin: string;
    title: string;
    image: string;
    price: number;
    currency: string;
    url: string;
  } {
    return {
      asin: catalogItem.asin || 'UNKNOWN',
      title: catalogItem.title,
      image: catalogItem.imageUrl || '',
      price: catalogItem.price ? parseFloat(catalogItem.price) : 0,
      currency: catalogItem.currency || 'EUR',
      url: catalogItem.url
    };
  }

  /**
   * Check if catalog provider is configured and active
   */
  static isProviderActive(): boolean {
    // Since we can't access env vars in frontend, we'll determine this based on API responses
    // The search API will return mock: true when no provider is active
    return true; // Always return true, let the API handle provider logic
  }
}