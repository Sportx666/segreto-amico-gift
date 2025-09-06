import { NextApiRequest, NextApiResponse } from 'next';
import mockData from './mock.json';

interface SearchRequest {
  q: string;
  page?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
}

interface ProductItem {
  asin: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  url: string;
  lastUpdated: string;
}

interface SearchResponse {
  items: ProductItem[];
  page: number;
  pageSize: number;
  total: number;
  mock: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SearchResponse | { error: string }>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q, page = 1, minPrice, maxPrice, category }: SearchRequest = req.body;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const amazonApiEnabled = process.env.AMAZON_API_ENABLED === 'true';
    const pageSize = 10;

    if (!amazonApiEnabled) {
      // Use mock data
      let filteredItems = mockData.items.filter(item => {
        const matchesQuery = item.title.toLowerCase().includes(q.toLowerCase()) ||
                            item.category?.toLowerCase().includes(q.toLowerCase());
        
        const matchesPrice = (!minPrice || item.price >= minPrice) &&
                            (!maxPrice || item.price <= maxPrice);
        
        const matchesCategory = !category || 
                               item.category?.toLowerCase().includes(category.toLowerCase());
        
        return matchesQuery && matchesPrice && matchesCategory;
      });

      const total = filteredItems.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      filteredItems = filteredItems.slice(startIndex, endIndex);

      const response: SearchResponse = {
        items: filteredItems.map(item => ({
          asin: item.asin,
          title: item.title,
          image: item.image,
          price: item.price,
          currency: item.currency,
          url: item.url,
          lastUpdated: item.lastUpdated
        })),
        page,
        pageSize,
        total,
        mock: true
      };

      return res.status(200).json(response);
    }

    // TODO: Implement PA-API 5.0 SearchItems when AMAZON_API_ENABLED=true
    // This would require:
    // - Amazon Product Advertising API credentials
    // - Proper request signing
    // - Mapping PA-API response to our format
    
    return res.status(501).json({ error: 'Amazon PA-API integration not yet implemented' });

  } catch (error) {
    console.error('Amazon search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}