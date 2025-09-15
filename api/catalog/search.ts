import type { VercelRequest, VercelResponse } from '@vercel/node';

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

      const items: CatalogItem[] = (data.search_results || []).map((item: any) => {
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

// Fallback mock data for when APIs are unavailable
const MOCK_ITEMS: CatalogItem[] = [
  {
    title: 'LEGO Creator Set di Costruzione',
    imageUrl: 'https://via.placeholder.com/400?text=LEGO',
    asin: 'MOCK001',
    url: 'https://www.amazon.it/dp/MOCK001',
    price: '49.99',
    currency: 'EUR'
  },
  {
    title: 'Libro di Ricette Italiane',
    imageUrl: 'https://via.placeholder.com/400?text=Libro',
    asin: 'MOCK002',
    url: 'https://www.amazon.it/dp/MOCK002',
    price: '19.99',
    currency: 'EUR'
  }
];

function extractAsinFromUrl(url: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match?.[1];
}

function getMockResults(query: string, page: number): { items: CatalogItem[]; total: number } {
  const filtered = MOCK_ITEMS.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  );
  
  const pageSize = 10;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  
  return { items, total: filtered.length };
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

    const provider = process.env.CATALOG_PROVIDER;
    
    if (provider === 'rainforest') {
      const apiKey = process.env.RAINFOREST_API_KEY;
      const domain = process.env.RAINFOREST_DOMAIN || 'amazon.it';
      
      if (!apiKey) {
        console.warn('RAINFOREST_API_KEY not configured, falling back to mock data');
        const mockResult = getMockResults(query, Number(page));
        cache.set(cacheKey, { ...mockResult, timestamp: Date.now() });
        return res.status(200).json({ 
          ...mockResult, 
          page: Number(page), 
          pageSize: 10, 
          mock: true 
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
            error: 'Limite di ricerche raggiunto. Riprova tra qualche minuto.',
            fallback: true
          });
        }
        
        // For other errors, fall back to mock data
        console.warn('Falling back to mock data due to API error');
        const mockResult = getMockResults(query, Number(page));
        cache.set(cacheKey, { ...mockResult, timestamp: Date.now() });
        return res.status(200).json({ 
          ...mockResult, 
          page: Number(page), 
          pageSize: 10, 
          mock: true,
          fallback: true
        });
      }
    }

    // Default fallback to mock data
    const mockResult = getMockResults(query, Number(page));
    cache.set(cacheKey, { ...mockResult, timestamp: Date.now() });
    return res.status(200).json({ 
      ...mockResult, 
      page: Number(page), 
      pageSize: 10, 
      mock: true 
    });

  } catch (error: any) {
    console.error('Catalog search error:', error);
    return res.status(500).json({ 
      error: 'Si è verificato un errore durante la ricerca. Riprova tra qualche minuto.' 
    });
  }
}