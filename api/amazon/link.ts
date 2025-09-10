import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CacheEntry {
  url: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function addAffiliateTag(url: string): string {
  const associateTag = process.env.AMZ_ASSOC_TAG;
  if (!associateTag) return url;
  
  try {
    const urlObj = new URL(url);
    
    // Only process Amazon URLs
    if (!urlObj.hostname.includes('amazon.')) {
      return url;
    }
    
    // Add or update the tag parameter
    urlObj.searchParams.set('tag', associateTag);
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Invalid URL provided:', url);
    return url;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, asin, title } = (req.body || {}) as { 
    url?: string; 
    asin?: string; 
    title?: string; 
  };
  
  if (!url && !asin) {
    return res.status(400).json({ error: 'Missing url or asin parameter' });
  }

  // Check cache first
  const cacheKey = `link:${url || asin}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({ url: cached.url, cached: true });
  }

  try {
    let resultUrl: string;

    if (url) {
      // Process existing URL
      resultUrl = addAffiliateTag(url);
    } else if (asin) {
      // Generate URL from ASIN
      const slug = title 
        ? title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50)
        : '';
      
      const baseUrl = `https://www.amazon.it/dp/${asin}`;
      const urlWithSlug = slug ? `${baseUrl}/${slug}` : baseUrl;
      resultUrl = addAffiliateTag(urlWithSlug);
    } else {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Cache the result
    cache.set(cacheKey, { url: resultUrl, timestamp: Date.now() });

    return res.status(200).json({ url: resultUrl });

  } catch (error: any) {
    console.error('Link generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}