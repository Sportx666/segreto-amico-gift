import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import type { Item } from './types';

interface CacheEntry {
  data: Item;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

// PA-API v5 signing utilities
function createSignedRequest(params: any, method: string = 'POST') {
  const accessKey = process.env.AMZ_ACCESS_KEY;
  const secretKey = process.env.AMZ_SECRET_KEY;
  const region = process.env.AMZ_REGION || 'eu-west-1';
  
  if (!accessKey || !secretKey) {
    throw new Error('Amazon API credentials not configured');
  }

  const host = `webservices.amazon.${region === 'us-east-1' ? 'com' : region.replace('us-', '').replace('eu-', '')}`;
  const endpoint = `/paapi5/getitems`;
  
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
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'
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
  const associateTag = process.env.AMZ_ASSOC_TAG;
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

  const enabled = String(process.env.AMAZON_API_ENABLED || 'false').toLowerCase() === 'true';
  const { asin } = (req.body || {}) as { asin?: string };
  
  if (!asin) {
    return res.status(400).json({ error: 'Missing asin parameter' });
  }

  // Check cache first
  const cacheKey = `item:${asin}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({ item: cached.data, cached: true });
  }

  if (!enabled) {
    // Return mock data
    const mockItem: Item = {
      asin,
      title: `Prodotto ${asin}`,
      image: `https://via.placeholder.com/400?text=${asin}`,
      price: Math.round(Math.random() * 100 + 10),
      currency: 'EUR',
      url: addAffiliateTag(`https://www.amazon.it/dp/${asin}`),
      lastUpdated: new Date().toISOString(),
    };
    
    cache.set(cacheKey, { data: mockItem, timestamp: Date.now() });
    return res.status(200).json({ item: mockItem, mock: true });
  }

  try {
    const associateTag = process.env.AMZ_ASSOC_TAG;
    if (!associateTag) {
      throw new Error('AMZ_ASSOC_TAG not configured');
    }

    const params = {
      ItemIds: [asin],
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'ItemInfo.Features'
      ],
      PartnerTag: associateTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.it'
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

    const item = data.ItemsResult?.Items?.[0];
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const result: Item = {
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Title',
      image: item.Images?.Primary?.Large?.URL || '',
      price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
      currency: item.Offers?.Listings?.[0]?.Price?.Currency || null,
      url: addAffiliateTag(item.DetailPageURL || `https://www.amazon.it/dp/${asin}`),
      lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return res.status(200).json({ item: result });

  } catch (error: any) {
    console.error('Amazon API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}