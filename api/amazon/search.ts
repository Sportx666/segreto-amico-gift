import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import type { Item } from './types';
import { config } from '@/config/env';

interface CacheEntry {
  items: Item[];
  total: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// PA-API v5 signing utilities
function createSignedRequest(params: any, method: string = 'POST') {
  const accessKey = config.catalog.amzAccessKey;
  const secretKey = config.catalog.amzSecretKey;
  const region = config.catalog.amzRegion;
  
  if (!accessKey || !secretKey) {
    throw new Error('Amazon API credentials not configured');
  }

  const host = `webservices.amazon.${region === 'eu-west-1' ? 'co.uk' : 'com'}`;
  const endpoint = `/paapi5/searchitems`;
  
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substr(0, 8);
  
  const credentialScope = `${date}/${region}/ProductAdvertisingAPI/aws4_request`;
  const algorithm = 'AWS4-HMAC-SHA256';
  
  const canonicalHeaders = `host:${host}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = 'host;x-amz-date';
  
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
  
  const canonicalRequest = `${method}\n${endpoint}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  
  const signingKey = getSignatureKey(secretKey, date, region, 'ProductAdvertisingAPI');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    url: `https://${host}${endpoint}`,
    headers: {
      'Authorization': authorization,
      'X-Amz-Date': timestamp,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    },
    body: JSON.stringify(params)
  };
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

function addAffiliateTag(url: string): string {
  const associateTag = config.catalog.amzAssocTag;
  if (!associateTag) return url;
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('tag', associateTag);
    return urlObj.toString();
  } catch {
    return url;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const enabled = config.catalog.amazonApiEnabled;
  const { q = '', page = 1 } = (req.body || {}) as { q?: string; page?: number };
  const query = (q || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing q' });

  // Check cache first
  const cacheKey = `search:${query}:${page}`;
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

  // Check if Amazon API is enabled
  if (!enabled) {
    return res.status(503).json({ 
      error: 'Servizio Amazon temporaneamente non disponibile. Riprova più tardi.' 
    });
  }

  try {
    const associateTag = config.catalog.amzAssocTag;
    if (!associateTag) {
      throw new Error('AMZ_ASSOC_TAG not configured');
    }

    const params = {
      Keywords: query,
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'Offers.Listings.Price'
      ],
      PartnerTag: associateTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.it',
      ItemPage: Number(page),
      ItemCount: 10
    };

    const signedRequest = createSignedRequest(params);
    
    const response = await fetch(signedRequest.url, {
      method: 'POST',
      headers: signedRequest.headers,
      body: signedRequest.body
    });

    if (!response.ok) {
      throw new Error(`PA-API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.Errors?.length > 0) {
      throw new Error(`PA-API error: ${data.Errors[0].Message}`);
    }

    const items: Item[] = (data.SearchResult?.Items || []).map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Title',
      image: item.Images?.Primary?.Large?.URL || '',
      price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
      currency: item.Offers?.Listings?.[0]?.Price?.Currency || null,
      url: addAffiliateTag(item.DetailPageURL || `https://www.amazon.it/dp/${item.ASIN}`),
      lastUpdated: new Date().toISOString(),
    }));

    const total = data.SearchResult?.TotalResultCount || items.length;

    // Cache the results
    cache.set(cacheKey, { items, total, timestamp: Date.now() });

    return res.status(200).json({ items, total, page: Number(page), pageSize: 10 });

  } catch (error: any) {
    console.error('Amazon API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
// import mockData from './mock.json';  // <-- Use this if using "resolveJsonModule" in tsconfig.json