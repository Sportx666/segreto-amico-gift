import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config } from '../../src/config/env';

export interface CatalogItem {
  title: string;
  imageUrl?: string;
  asin?: string;
  url: string;
  price?: string;
  currency?: string;
}

interface CacheEntry {
  items: CatalogItem[];
  total: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Rainforest API client
class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string, domain: string = 'amazon.it') {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  async search(query: string, page: number = 1, minPrice?: number, maxPrice?: number): Promise<{ items: CatalogItem[]; total: number }> {
    const url = 'https://api.rainforestapi.com/request';
    const params = new URLSearchParams({
      api_key: this.apiKey,
      type: 'search',
      amazon_domain: this.domain,
      search_term: query,
      page: page.toString()
    });

    // Add price filtering if provided
    if (minPrice !== undefined && minPrice > 0) {
      params.append('min_price', minPrice.toString());
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      params.append('max_price', maxPrice.toString());
    }

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

      let items: CatalogItem[] = (data.search_results || []).map((item: any) => {
        const asin = item.asin || extractAsinFromUrl(item.link);
        return {
          title: item.title || 'Unknown Title',
          imageUrl: item.image,
          asin,
          url: asin ? `https://www.${this.domain}/dp/${asin}` : item.link,
          price: item.price?.value ? item.price.value.toString() : undefined,
          currency: item.price?.currency || 'EUR'
        };
      });

      // Sort by price low to high when price filters are applied
      if (minPrice !== undefined || maxPrice !== undefined) {
        items = sortItemsByPrice(items, true);
      }

      return {
        items,
        total: data.pagination?.total_results || items.length
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

function extractAsinFromUrl(url: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match?.[1];
}

function sortItemsByPrice(items: CatalogItem[], ascending: boolean = true): CatalogItem[] {
  return items.sort((a, b) => {
    const priceA = parseFloat(a.price || '0');
    const priceB = parseFloat(b.price || '0');
    return ascending ? priceA - priceB : priceB - priceA;
  });
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
    const { q = '', page = 1, minPrice, maxPrice } = (req.body || {}) as { 
      q?: string; 
      page?: number; 
      minPrice?: number; 
      maxPrice?: number; 
    };
    const query = (q || '').trim();
    
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    // Check cache first
    const cacheKey = `search:${query}:${page}:${minPrice || ''}:${maxPrice || ''}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({ 
        items: cached.items, 
        total: cached.total, 
        page: Number(page), 
        pageSize: 10, 
        cached: true 
      });
    }

    const provider = config.catalog.provider;
    
    if (provider === 'rainforest') {
      const apiKey = config.catalog.rainforestApiKey;
      const domain = config.catalog.rainforestDomain;
      
      if (!apiKey) {
        return res.status(503).json({ 
          error: 'Servizio di ricerca temporaneamente non disponibile. Riprova più tardi.' 
        });
      }

      try {
        const client = new RainforestClient(apiKey, domain);
        const result = await client.search(query, Number(page), minPrice, maxPrice);
        
        // Cache the results
        cache.set(cacheKey, { ...result, timestamp: Date.now() });
        
        return res.status(200).json({
          items: result.items,
          total: result.total,
          page: Number(page),
          pageSize: 10,
          provider: 'rainforest'
        });
      } catch (error: any) {
        console.error('Rainforest API error:', error.message);
        
        // Return user-friendly error for rate limits
        if (error.message === 'API_RATE_LIMIT') {
          return res.status(429).json({ 
            error: 'Limite di ricerche raggiunto. Riprova tra qualche minuto.'
          });
        }
        
        // For other errors, return error without fallback
        return res.status(503).json({ 
          error: 'Servizio di ricerca temporaneamente non disponibile. Riprova più tardi.'
        });
      }
    }

    // No catalog provider configured
    return res.status(503).json({ 
      error: 'Servizio di ricerca non configurato. Contatta il supporto.' 
    });

  } catch (error: any) {
    console.error('Catalog search error:', error);
    return res.status(500).json({ 
      error: 'Si è verificato un errore durante la ricerca. Riprova tra qualche minuto.' 
    });
  }
}