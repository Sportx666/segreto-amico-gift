import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CacheEntry {
  items: any[]
  total: number
  timestamp: number
}

interface Item {
  asin: string
  title: string
  image: string
  price: number | null
  currency: string | null
  url: string
  lastUpdated: string
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

// PA-API v5 signing utilities
function createSignedRequest(params: any, method: string = 'POST') {
  const accessKey = Deno.env.get('AMZ_ACCESS_KEY')
  const secretKey = Deno.env.get('AMZ_SECRET_KEY')
  const region = Deno.env.get('AMZ_REGION') || 'eu-west-1'
  
  if (!accessKey || !secretKey) {
    throw new Error('Amazon API credentials not configured')
  }

  const host = `webservices.amazon.${region === 'eu-west-1' ? 'co.uk' : 'com'}`
  const endpoint = `/paapi5/searchitems`
  
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const date = timestamp.substr(0, 8)
  
  const credentialScope = `${date}/${region}/ProductAdvertisingAPI/aws4_request`
  const algorithm = 'AWS4-HMAC-SHA256'
  
  const canonicalHeaders = `host:${host}\nx-amz-date:${timestamp}\n`
  const signedHeaders = 'host;x-amz-date'
  
  const payloadHash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(params)))
    .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''))
  
  // For edge functions, we need to use crypto.subtle which is async
  // This is a simplified version - in production you'd need proper AWS signing
  return {
    url: `https://${host}${endpoint}`,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    },
    body: JSON.stringify(params)
  }
}

function addAffiliateTag(url: string): string {
  const associateTag = Deno.env.get('AMZ_ASSOC_TAG')
  if (!associateTag) return url
  
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('tag', associateTag)
    return urlObj.toString()
  } catch {
    return url
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const enabled = String(Deno.env.get('AMAZON_API_ENABLED') || 'false').toLowerCase() === 'true'
    const { q = '', page = 1 } = await req.json()
    const query = (q || '').trim()
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing q' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check cache first
    const cacheKey = `search:${query}:${page}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({ 
        items: cached.items, 
        total: cached.total, 
        page: Number(page), 
        pageSize: 10, 
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if Amazon API is enabled
    if (!enabled) {
      return new Response(JSON.stringify({ 
        error: 'Servizio Amazon temporaneamente non disponibile. Riprova più tardi.' 
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const associateTag = Deno.env.get('AMZ_ASSOC_TAG')
    if (!associateTag) {
      throw new Error('AMZ_ASSOC_TAG not configured')
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
    }

    // Note: Full AWS signing implementation would be complex in edge functions
    // For now, return a service unavailable response if credentials aren't properly configured
    const accessKey = Deno.env.get('AMZ_ACCESS_KEY')
    const secretKey = Deno.env.get('AMZ_SECRET_KEY')
    
    if (!accessKey || !secretKey) {
      return new Response(JSON.stringify({ 
        error: 'Servizio Amazon temporaneamente non disponibile. Riprova più tardi.' 
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Simplified request (without proper signing) - in production you'd need full AWS signing
    const signedRequest = createSignedRequest(params)
    
    const response = await fetch(signedRequest.url, {
      method: 'POST',
      headers: signedRequest.headers,
      body: signedRequest.body
    })

    if (!response.ok) {
      throw new Error(`PA-API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.Errors?.length > 0) {
      throw new Error(`PA-API error: ${data.Errors[0].Message}`)
    }

    const items: Item[] = (data.SearchResult?.Items || []).map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Title',
      image: item.Images?.Primary?.Large?.URL || '',
      price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
      currency: item.Offers?.Listings?.[0]?.Price?.Currency || null,
      url: addAffiliateTag(item.DetailPageURL || `https://www.amazon.it/dp/${item.ASIN}`),
      lastUpdated: new Date().toISOString(),
    }))

    const total = data.SearchResult?.TotalResultCount || items.length

    // Cache the results
    cache.set(cacheKey, { items, total, timestamp: Date.now() })

    return new Response(JSON.stringify({ items, total, page: Number(page), pageSize: 10 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Amazon API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})