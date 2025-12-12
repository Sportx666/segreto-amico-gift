import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// UNIFIED CATALOG PROVIDER CONFIGURATION
// ============================================================
// Switch providers by setting ONE secret: CATALOG_PROVIDER
//   - "rainforest" = Use Rainforest API
//   - "amazon" = Use Amazon Product Advertising API (PA-API v5)
//   - "mock" = Return mock data for testing
//
// Switch marketplaces by setting: AMAZON_MARKETPLACE
//   - "IT", "US", "UK", "DE", "FR", "ES" (default: IT)
//
// Required secrets for each provider:
//   rainforest: RAINFOREST_API_KEY
//   amazon: AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY
//   all: AMZ_ASSOC_TAG (affiliate tag for URL tagging)
// ============================================================

// Marketplace configuration - static lookup table
const MARKETPLACE_CONFIG: Record<string, { domain: string; currency: string; host: string; region: string }> = {
  IT: { domain: 'amazon.it', currency: 'EUR', host: 'webservices.amazon.it', region: 'eu-west-1' },
  US: { domain: 'amazon.com', currency: 'USD', host: 'webservices.amazon.com', region: 'us-east-1' },
  UK: { domain: 'amazon.co.uk', currency: 'GBP', host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  DE: { domain: 'amazon.de', currency: 'EUR', host: 'webservices.amazon.de', region: 'eu-west-1' },
  FR: { domain: 'amazon.fr', currency: 'EUR', host: 'webservices.amazon.fr', region: 'eu-west-1' },
  ES: { domain: 'amazon.es', currency: 'EUR', host: 'webservices.amazon.es', region: 'eu-west-1' },
};

// ============================================================
// MODULE-SCOPE CONFIGURATION - Computed ONCE at startup
// ============================================================
const CONFIG = (() => {
  // Marketplace resolution
  const marketplaceCode = Deno.env.get('AMAZON_MARKETPLACE') || 'IT';
  const marketplaceData = MARKETPLACE_CONFIG[marketplaceCode] || MARKETPLACE_CONFIG.IT;
  const effectiveMarketplace = MARKETPLACE_CONFIG[marketplaceCode] ? marketplaceCode : 'IT';
  
  // Affiliate tag resolution with merge strategy
  const amzTag = Deno.env.get("AMZ_ASSOC_TAG");
  const paapiTag = Deno.env.get("AMAZON_PAAPI_PARTNER_TAG");
  const rainforestTag = Deno.env.get("RAINFOREST_ASSOC_TAG");
  
  // Deterministic merge: prefer AMZ_ASSOC_TAG > AMAZON_PAAPI_PARTNER_TAG > RAINFOREST_ASSOC_TAG
  const affiliateTag = amzTag || paapiTag || rainforestTag || "yourtag-21";
  
  // Log warnings ONCE at module initialization
  if (amzTag && paapiTag && amzTag !== paapiTag) {
    console.warn("⚠️ Conflicting affiliate tags: AMZ_ASSOC_TAG and AMAZON_PAAPI_PARTNER_TAG differ. Using AMZ_ASSOC_TAG.");
  }
  if (affiliateTag === "yourtag-21") {
    console.warn("⚠️ Amazon affiliate tag not configured, using fallback");
  }
  
  // Provider
  const provider = Deno.env.get("CATALOG_PROVIDER") || "";
  
  // Rainforest
  const rainforestApiKey = Deno.env.get("RAINFOREST_API_KEY") || "";
  
  // Amazon PA-API
  const amazonAccessKey = Deno.env.get("AMAZON_PAAPI_ACCESS_KEY") || "";
  const amazonSecretKey = Deno.env.get("AMAZON_PAAPI_SECRET_KEY") || "";
  const amazonRegion = Deno.env.get("AMAZON_PAAPI_REGION") || marketplaceData.region;
  
  // Timeout
  const timeout = Number(Deno.env.get('RAINFOREST_TIMEOUT_MS') || 25000);
  
  console.log(`Config initialized: provider=${provider}, marketplace=${effectiveMarketplace} -> ${marketplaceData.domain}`);
  
  return {
    provider,
    marketplace: { ...marketplaceData, code: effectiveMarketplace },
    affiliateTag,
    rainforestApiKey,
    amazon: {
      accessKey: amazonAccessKey,
      secretKey: amazonSecretKey,
      partnerTag: affiliateTag,
      region: amazonRegion,
      host: marketplaceData.host,
    },
    timeout,
  };
})();

// Precompiled regex for performance
const AMAZON_HOST_REGEX = /amazon\./;
const ASIN_DP_REGEX = /\/dp\/([A-Z0-9]{10})/i;
const ASIN_GP_REGEX = /\/gp\/product\/([A-Z0-9]{10})/i;

// ============================================================
// UTILITY FUNCTIONS - Use precomputed config
// ============================================================
function withAffiliateTag(url: string): string {
  try {
    const amazonUrl = new URL(url);
    if (!AMAZON_HOST_REGEX.test(amazonUrl.hostname)) return url;
    amazonUrl.searchParams.set('tag', CONFIG.affiliateTag);
    return amazonUrl.toString();
  } catch {
    return url;
  }
}

function extractAsinFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(ASIN_DP_REGEX) || url.match(ASIN_GP_REGEX);
  return match?.[1];
}

// Response helpers - DRY
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, error: string): Response {
  return jsonResponse({ error }, status);
}

// Unified response interface
interface CatalogItem {
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

// Optimized retry: max 2 attempts, fast-fail on 4xx
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || '';
      console.log(`Attempt ${attempt} failed: ${msg}`);
      
      if (attempt === maxAttempts) throw error;
      
      // Fast-fail on unrecoverable errors (4xx, auth, config)
      if (msg.includes('AUTH') || msg.includes('CREDENTIALS') || msg.match(/^4\d\d/)) {
        throw error;
      }
      
      // Only retry on network/timeout/5xx errors
      const shouldRetry = error?.name === 'AbortError' || 
                         msg.includes('timeout') ||
                         msg.includes('network') ||
                         msg.match(/^5\d\d/);
      if (!shouldRetry) throw error;
      
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error('Max attempts reached');
}

// ============================================================
// RAINFOREST PROVIDER - Uses precomputed config
// ============================================================
class RainforestClient {
  private apiKey: string;
  private domain: string;
  private currency: string;

  constructor(apiKey: string, domain: string, currency: string) {
    this.apiKey = apiKey;
    this.domain = domain;
    this.currency = currency;
  }

  async search(query: string, page: number = 1, minPrice?: number, maxPrice?: number): Promise<{ items: CatalogItem[]; total: number }> {
    return withRetry(async () => {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        type: "search",
        amazon_domain: this.domain,
        search_term: query,
        page: String(page),
      });

      if (minPrice !== undefined && minPrice > 0) params.append("min_price", String(minPrice));
      if (maxPrice !== undefined && maxPrice > 0) params.append("max_price", String(maxPrice));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      try {
        const response = await fetch(`https://api.rainforestapi.com/request?${params}`, {
          signal: controller.signal,
          headers: { "User-Agent": "AmiciSegreto/1.0", "Accept": "application/json" },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) throw new Error("API_RATE_LIMIT");
          throw new Error(`Rainforest API error: ${response.status}`);
        }

        const data = await response.json();
        if ((data as any).error) throw new Error((data as any).error);

        const items: CatalogItem[] = ((data as any).search_results || []).map((item: any) => {
          const asin = item.asin || extractAsinFromUrl(item.link);
          const baseUrl = asin ? `https://www.${this.domain}/dp/${asin}` : item.link;
          return {
            title: item.title || "Unknown Title",
            imageUrl: item.image,
            asin,
            url: withAffiliateTag(baseUrl),
            price: item.price?.value ? String(item.price.value) : undefined,
            currency: item.price?.currency || this.currency,
          };
        });

        return { items, total: (data as any).pagination?.total_results || items.length };
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as any).name === "AbortError") throw new Error("Request timeout");
        throw error;
      }
    });
  }
}

// ============================================================
// AMAZON PA-API v5 PROVIDER - Uses precomputed config
// ============================================================
class AmazonPAAPIClient {
  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private host: string;
  private region: string;
  private domain: string;
  private currency: string;

  constructor(
    accessKey: string,
    secretKey: string,
    partnerTag: string,
    host: string,
    region: string,
    domain: string,
    currency: string
  ) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.partnerTag = partnerTag;
    this.host = host;
    this.region = region;
    this.domain = domain;
    this.currency = currency;
  }

  isConfigured(): boolean {
    return !!(this.accessKey && this.secretKey && this.partnerTag);
  }

  async search(query: string, page: number = 1, minPrice?: number, maxPrice?: number): Promise<{ items: CatalogItem[]; total: number }> {
    if (!this.isConfigured()) {
      throw new Error("AMAZON_PAAPI_CREDENTIALS_MISSING");
    }

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      try {
        const payload = this.buildSearchPayload(query, page, minPrice, maxPrice);
        const headers = await this.signRequest("/paapi5/searchitems", payload);

        const response = await fetch(`https://${this.host}/paapi5/searchitems`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Amazon PA-API error: ${response.status}`, errorText.slice(0, 200));
          if (response.status === 429) throw new Error("API_RATE_LIMIT");
          if (response.status === 401 || response.status === 403) throw new Error("AMAZON_PAAPI_AUTH_ERROR");
          throw new Error(`Amazon PA-API error: ${response.status}`);
        }

        const data = await response.json();
        return this.parseSearchResponse(data);
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as any).name === "AbortError") throw new Error("Request timeout");
        throw error;
      }
    });
  }

  private buildSearchPayload(query: string, page: number, minPrice?: number, maxPrice?: number): any {
    const payload: any = {
      Keywords: query,
      Resources: [
        "Images.Primary.Large",
        "ItemInfo.Title",
        "Offers.Listings.Price",
      ],
      PartnerTag: this.partnerTag,
      PartnerType: "Associates",
      Marketplace: `www.${this.domain}`,
      ItemPage: page,
    };

    if (minPrice !== undefined && minPrice > 0) {
      payload.MinPrice = Math.round(minPrice * 100);
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      payload.MaxPrice = Math.round(maxPrice * 100);
    }

    return payload;
  }

  private parseSearchResponse(data: any): { items: CatalogItem[]; total: number } {
    const searchResult = data.SearchResult;
    if (!searchResult || !searchResult.Items) {
      return { items: [], total: 0 };
    }

    const items: CatalogItem[] = searchResult.Items.map((item: any) => {
      const asin = item.ASIN;
      const title = item.ItemInfo?.Title?.DisplayValue || "Unknown Title";
      const imageUrl = item.Images?.Primary?.Large?.URL;
      
      let price: string | undefined;
      let currency: string | undefined;
      const listing = item.Offers?.Listings?.[0];
      if (listing?.Price) {
        price = String(listing.Price.Amount);
        currency = listing.Price.Currency || this.currency;
      }

      const baseUrl = `https://www.${this.domain}/dp/${asin}`;

      return {
        title,
        imageUrl,
        asin,
        url: withAffiliateTag(baseUrl),
        price,
        currency: currency || this.currency,
      };
    });

    return {
      items,
      total: searchResult.TotalResultCount || items.length,
    };
  }

  private async signRequest(path: string, payload: any): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const service = "ProductAdvertisingAPI";

    const canonicalHeaders = [
      `content-encoding:amz-1.0`,
      `content-type:application/json; charset=utf-8`,
      `host:${this.host}`,
      `x-amz-date:${timestamp}`,
      `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems`,
    ].join('\n');

    const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
    const payloadHash = await this.sha256(JSON.stringify(payload));
    
    const canonicalRequest = [
      "POST",
      path,
      "",
      canonicalHeaders,
      "",
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${date}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      timestamp,
      credentialScope,
      await this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await this.getSignatureKey(date, service);
    const signature = await this.hmacHex(signingKey, stringToSign);

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      "Content-Encoding": "amz-1.0",
      "Content-Type": "application/json; charset=utf-8",
      "Host": this.host,
      "X-Amz-Date": timestamp,
      "X-Amz-Target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      "Authorization": authorization,
    };
  }

  private async sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
    return new Uint8Array(signature);
  }

  private async hmacHex(key: Uint8Array, message: string): Promise<string> {
    const signature = await this.hmacSha256(key, message);
    return Array.from(signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async getSignatureKey(dateStamp: string, serviceName: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const kDate = await this.hmacSha256(encoder.encode("AWS4" + this.secretKey), dateStamp);
    const kRegion = await this.hmacSha256(kDate, this.region);
    const kService = await this.hmacSha256(kRegion, serviceName);
    const kSigning = await this.hmacSha256(kService, "aws4_request");
    return kSigning;
  }
}

// ============================================================
// SINGLETON CLIENTS - Initialized ONCE at module load
// ============================================================
const rainforestClient = CONFIG.rainforestApiKey 
  ? new RainforestClient(CONFIG.rainforestApiKey, CONFIG.marketplace.domain, CONFIG.marketplace.currency)
  : null;

const amazonClient = (CONFIG.amazon.accessKey && CONFIG.amazon.secretKey)
  ? new AmazonPAAPIClient(
      CONFIG.amazon.accessKey,
      CONFIG.amazon.secretKey,
      CONFIG.amazon.partnerTag,
      CONFIG.amazon.host,
      CONFIG.amazon.region,
      CONFIG.marketplace.domain,
      CONFIG.marketplace.currency
    )
  : null;

// ============================================================
// MOCK PROVIDER - Uses precomputed config
// ============================================================
function getMockResults(query: string, page: number): { items: CatalogItem[]; total: number } {
  const items: CatalogItem[] = Array.from({ length: 10 }, (_, i) => ({
    title: `${query} - Prodotto Mock ${(page - 1) * 10 + i + 1}`,
    imageUrl: `https://via.placeholder.com/300?text=${encodeURIComponent(query)}`,
    asin: `MOCK${String(i).padStart(6, '0')}`,
    url: withAffiliateTag(`https://www.${CONFIG.marketplace.domain}/dp/MOCK${String(i).padStart(6, '0')}`),
    price: String((Math.random() * 100 + 10).toFixed(2)),
    currency: CONFIG.marketplace.currency,
  }));
  return { items, total: 50 };
}

// ============================================================
// MAIN HANDLER - Optimized hot path
// ============================================================
serve(async (req: Request) => {
  // CORS handling - fast path
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  // Method validation - fast path
  if (req.method !== "POST") return errorResponse(405, "Method Not Allowed");

  try {
    // Request parsing
    const body = await req.json().catch(() => ({}));
    const query = String(body.q || "").trim();
    
    // Early bail for empty query
    if (!query) return errorResponse(400, "Missing search query");
    
    const page = Number(body.page || 1);
    const { minPrice, maxPrice } = body;

    // Normalize cache key for better hit rate
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ');
    const cacheKey = `search:${normalizedQuery}:${page}:${minPrice || ""}:${maxPrice || ""}`;
    
    // Fast cache check
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return jsonResponse({ 
        items: cached.items, 
        total: cached.total, 
        page, 
        pageSize: 10, 
        provider: CONFIG.provider,
        cached: true 
      });
    }

    // Provider routing using prebuilt singletons
    
    // Provider: mock
    if (CONFIG.provider === "mock") {
      const result = getMockResults(query, page);
      cache.set(cacheKey, { ...result, timestamp: Date.now() });
      return jsonResponse({ ...result, page, pageSize: 10, provider: "mock", mock: true });
    }

    // Provider: rainforest
    if (CONFIG.provider === "rainforest") {
      if (!rainforestClient) {
        console.error("RAINFOREST_API_KEY not configured");
        return errorResponse(503, "Servizio di ricerca temporaneamente non disponibile.");
      }

      try {
        const result = await rainforestClient.search(query, page, minPrice, maxPrice);
        cache.set(cacheKey, { ...result, timestamp: Date.now() });
        return jsonResponse({ ...result, page, pageSize: 10, provider: "rainforest" });
      } catch (error: any) {
        console.error("Rainforest error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return errorResponse(429, "Limite di ricerche raggiunto. Riprova tra qualche minuto.");
        }
        return errorResponse(503, "Servizio di ricerca temporaneamente non disponibile.");
      }
    }

    // Provider: amazon (PA-API v5)
    if (CONFIG.provider === "amazon") {
      if (!amazonClient || !amazonClient.isConfigured()) {
        console.error("Amazon PA-API credentials not configured");
        return errorResponse(503, "Servizio di ricerca temporaneamente non disponibile.");
      }

      try {
        const result = await amazonClient.search(query, page, minPrice, maxPrice);
        cache.set(cacheKey, { ...result, timestamp: Date.now() });
        return jsonResponse({ ...result, page, pageSize: 10, provider: "amazon" });
      } catch (error: any) {
        console.error("Amazon PA-API error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return errorResponse(429, "Limite di ricerche raggiunto. Riprova tra qualche minuto.");
        }
        if (error?.message === "AMAZON_PAAPI_AUTH_ERROR") {
          console.error("Amazon PA-API authentication failed - check credentials");
        }
        return errorResponse(503, "Servizio di ricerca temporaneamente non disponibile.");
      }
    }

    // No valid provider configured
    console.error(`Invalid or missing CATALOG_PROVIDER: "${CONFIG.provider}"`);
    return errorResponse(503, "Servizio di ricerca non configurato. Imposta CATALOG_PROVIDER.");
  } catch (error) {
    console.error("Catalog search error:", error);
    return errorResponse(500, "Errore durante la ricerca. Riprova più tardi.");
  }
});
