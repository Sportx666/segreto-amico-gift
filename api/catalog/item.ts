import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CatalogItem } from './search';
import { config } from '../../src/config/env';

interface CacheEntry {
  item: CatalogItem;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Rainforest API client for product details
class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string, domain: string = 'amazon.it') {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  async getProduct(asin: string): Promise<CatalogItem> {
    const url = 'https://api.rainforestapi.com/request';
    const params = new URLSearchParams({
      api_key: this.apiKey,
      type: 'product',
      amazon_domain: this.domain,
      asin: asin
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AmiciSegreto/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API_RATE_LIMIT');
        }
        throw new Error(`Rainforest API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const product = data.product;
      if (!product) {
        throw new Error('Product not found');
      }

      return {
        title: product.title || 'Unknown Title',
        imageUrl: product.main_image?.link,
        asin: product.asin,
        url: `https://www.${this.domain}/dp/${product.asin}`,
        price: product.buybox_winner?.price?.value ? product.buybox_winner.price.value.toString() : undefined,
        currency: product.buybox_winner?.price?.currency || 'EUR'
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
}

// Fallback mock data
function getMockProduct(asin: string): CatalogItem {
  return {
    title: `Prodotto ${asin}`,
    imageUrl: `https://via.placeholder.com/400?text=${asin}`,
    asin: asin,
    url: `https://www.amazon.it/dp/${asin}`,
    price: '29.99',
    currency: 'EUR'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { asin } = (req.body || {}) as { asin?: string };
    
    if (!asin || typeof asin !== 'string' || !/^[A-Z0-9]{10}$/i.test(asin)) {
      return res.status(400).json({ error: 'Valid ASIN required' });
    }

    // Check cache first
    const cacheKey = `item:${asin}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({ 
        item: cached.item,
        cached: true 
      });
    }

    const provider = config.catalog.provider;
    
    if (provider === 'rainforest') {
      const apiKey = config.catalog.rainforestApiKey;
      const domain = config.catalog.rainforestDomain;
      
      if (!apiKey) {
        console.warn('RAINFOREST_API_KEY not configured, falling back to mock data');
        const mockItem = getMockProduct(asin);
        cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
        return res.status(200).json({ item: mockItem, mock: true });
      }

      try {
        const client = new RainforestClient(apiKey, domain);
        const item = await client.getProduct(asin);
        
        // Cache the result
        cache.set(cacheKey, { item, timestamp: Date.now() });
        
        return res.status(200).json({
          item,
          provider: 'rainforest'
        });
      } catch (error: any) {
        console.error('Rainforest API error:', error.message);
        
        // Return user-friendly error for rate limits
        if (error.message === 'API_RATE_LIMIT') {
          return res.status(429).json({ 
            error: 'Limite di richieste raggiunto. Riprova tra qualche minuto.',
            fallback: true
          });
        }
        
        // For other errors, fall back to mock data
        console.warn('Falling back to mock data due to API error');
        const mockItem = getMockProduct(asin);
        cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
        return res.status(200).json({ 
          item: mockItem, 
          mock: true,
          fallback: true
        });
      }
    }

    // Default fallback to mock data
    const mockItem = getMockProduct(asin);
    cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
    return res.status(200).json({ 
      item: mockItem, 
      mock: true 
    });

  } catch (error: any) {
    console.error('Catalog item error:', error);
    return res.status(500).json({ 
      error: 'Si è verificato un errore durante il caricamento del prodotto. Riprova tra qualche minuto.' 
    });
  }
}