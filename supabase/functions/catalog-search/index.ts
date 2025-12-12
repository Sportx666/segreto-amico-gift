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
//   amazon: AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY, 
//           AMAZON_PAAPI_PARTNER_TAG, AMAZON_PAAPI_REGION
//   all: AMZ_ASSOC_TAG (affiliate tag for URL tagging)
// ============================================================

// Marketplace configuration - separated from provider logic
const MARKETPLACE_CONFIG: Record<string, { domain: string; currency: string; host: string; region: string }> = {
  IT: { domain: 'amazon.it', currency: 'EUR', host: 'webservices.amazon.it', region: 'eu-west-1' },
  US: { domain: 'amazon.com', currency: 'USD', host: 'webservices.amazon.com', region: 'us-east-1' },
  UK: { domain: 'amazon.co.uk', currency: 'GBP', host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  DE: { domain: 'amazon.de', currency: 'EUR', host: 'webservices.amazon.de', region: 'eu-west-1' },
  FR: { domain: 'amazon.fr', currency: 'EUR', host: 'webservices.amazon.fr', region: 'eu-west-1' },
  ES: { domain: 'amazon.es', currency: 'EUR', host: 'webservices.amazon.es', region: 'eu-west-1' },
};

// Marketplace resolution - separate from provider implementation
function getMarketplaceConfig() {
  const marketplace = Deno.env.get('AMAZON_MARKETPLACE') || 'IT';
  const config = MARKETPLACE_CONFIG[marketplace];
  if (!config) {
    console.log(`Invalid marketplace "${marketplace}", falling back to IT`);
    return { ...MARKETPLACE_CONFIG.IT, code: 'IT' };
  }
  console.log(`Using marketplace: ${marketplace} -> ${config.domain}`);
  return { ...config, code: marketplace };
}

function getAffiliateTag(): string {
  const tag = Deno.env.get("AMZ_ASSOC_TAG") || Deno.env.get("AMAZON_PAAPI_PARTNER_TAG") || Deno.env.get("RAINFOREST_ASSOC_TAG") || "yourtag-21";
  if (tag === "yourtag-21") {
    console.warn("⚠️ Amazon affiliate tag not configured, using fallback");
  }
  return tag;
}

function withAffiliateTag(url: string): string {
  try {
    const amazonUrl = new URL(url);
    if (!amazonUrl.hostname.includes('amazon.')) return url;
    amazonUrl.searchParams.set('tag', getAffiliateTag());
    return amazonUrl.toString();
  } catch {
    return url;
  }
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
const REQUEST_TIMEOUT = Number(Deno.env.get('RAINFOREST_TIMEOUT_MS') || 25000);

async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      console.log(`Attempt ${attempt} failed:`, error?.message);
      if (attempt === maxAttempts) throw error;
      const shouldRetry = error?.name === 'AbortError' || 
                         error?.message?.includes('timeout') ||
                         error?.message?.includes('network') ||
                         error?.message?.match(/5\d\d/);
      if (!shouldRetry) throw error;
      await new Promise(resolve => setTimeout(resolve, 800 * attempt));
    }
  }
  throw new Error('Max attempts reached');
}

// ============================================================
// RAINFOREST PROVIDER
// ============================================================
class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.domain = getMarketplaceConfig().domain;
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
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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

        const marketplaceConfig = getMarketplaceConfig();
        const items: CatalogItem[] = ((data as any).search_results || []).map((item: any) => {
          const asin = item.asin || extractAsinFromUrl(item.link);
          const baseUrl = asin ? `https://www.${this.domain}/dp/${asin}` : item.link;
          return {
            title: item.title || "Unknown Title",
            imageUrl: item.image,
            asin,
            url: withAffiliateTag(baseUrl),
            price: item.price?.value ? String(item.price.value) : undefined,
            currency: item.price?.currency || marketplaceConfig.currency,
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
// AMAZON PA-API v5 PROVIDER
// ============================================================
class AmazonPAAPIClient {
  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private host: string;
  private region: string;
  private domain: string;
  private currency: string;

  constructor() {
    this.accessKey = Deno.env.get("AMAZON_PAAPI_ACCESS_KEY") || "";
    this.secretKey = Deno.env.get("AMAZON_PAAPI_SECRET_KEY") || "";
    this.partnerTag = Deno.env.get("AMAZON_PAAPI_PARTNER_TAG") || getAffiliateTag();
    
    const marketplace = getMarketplaceConfig();
    this.host = marketplace.host;
    this.region = Deno.env.get("AMAZON_PAAPI_REGION") || marketplace.region;
    this.domain = marketplace.domain;
    this.currency = marketplace.currency;
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
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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
          console.error(`Amazon PA-API error: ${response.status}`, errorText);
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

    // Add price filters if specified (PA-API uses cents for price)
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
      
      // Extract price from offers
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
// MOCK PROVIDER
// ============================================================
function getMockResults(query: string, page: number): { items: CatalogItem[]; total: number } {
  const config = getMarketplaceConfig();
  const items: CatalogItem[] = Array.from({ length: 10 }, (_, i) => ({
    title: `${query} - Prodotto Mock ${(page - 1) * 10 + i + 1}`,
    imageUrl: `https://via.placeholder.com/300?text=${encodeURIComponent(query)}`,
    asin: `MOCK${String(i).padStart(6, '0')}`,
    url: withAffiliateTag(`https://www.${config.domain}/dp/MOCK${String(i).padStart(6, '0')}`),
    price: String((Math.random() * 100 + 10).toFixed(2)),
    currency: config.currency,
  }));
  return { items, total: 50 };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function extractAsinFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match?.[1];
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
  // CORS handling
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  // Method validation
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Request parsing
    const body = await req.json().catch(() => ({}));
    const { q = "", page = 1, minPrice, maxPrice } = body;
    const query = String(q || "").trim();

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing search query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache
    const cacheKey = `search:${query}:${page}:${minPrice || ""}:${maxPrice || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const provider = Deno.env.get("CATALOG_PROVIDER") || "unknown";
      return new Response(
        JSON.stringify({ 
          items: cached.items, 
          total: cached.total, 
          page: Number(page), 
          pageSize: 10, 
          provider,
          cached: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Provider routing
    const provider = Deno.env.get("CATALOG_PROVIDER");
    console.log(`CATALOG_PROVIDER: ${provider}, AMAZON_MARKETPLACE: ${Deno.env.get('AMAZON_MARKETPLACE') || 'IT'}`);

    // Provider: mock
    if (provider === "mock") {
      const result = getMockResults(query, Number(page));
      cache.set(cacheKey, { ...result, timestamp: Date.now() });
      return new Response(
        JSON.stringify({ ...result, page: Number(page), pageSize: 10, provider: "mock", mock: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Provider: rainforest
    if (provider === "rainforest") {
      const apiKey = Deno.env.get("RAINFOREST_API_KEY");
      if (!apiKey) {
        console.error("RAINFOREST_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        const client = new RainforestClient(apiKey);
        const result = await client.search(query, Number(page), minPrice, maxPrice);
        cache.set(cacheKey, { ...result, timestamp: Date.now() });
        return new Response(
          JSON.stringify({ ...result, page: Number(page), pageSize: 10, provider: "rainforest" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error: any) {
        console.error("Rainforest error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Limite di ricerche raggiunto. Riprova tra qualche minuto." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Provider: amazon (PA-API v5)
    if (provider === "amazon") {
      const client = new AmazonPAAPIClient();
      if (!client.isConfigured()) {
        console.error("Amazon PA-API credentials not configured");
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        const result = await client.search(query, Number(page), minPrice, maxPrice);
        cache.set(cacheKey, { ...result, timestamp: Date.now() });
        return new Response(
          JSON.stringify({ ...result, page: Number(page), pageSize: 10, provider: "amazon" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error: any) {
        console.error("Amazon PA-API error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Limite di ricerche raggiunto. Riprova tra qualche minuto." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (error?.message === "AMAZON_PAAPI_AUTH_ERROR") {
          console.error("Amazon PA-API authentication failed - check credentials");
        }
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // No valid provider configured
    console.error(`Invalid or missing CATALOG_PROVIDER: "${provider}"`);
    return new Response(
      JSON.stringify({ error: "Servizio di ricerca non configurato. Imposta CATALOG_PROVIDER." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Catalog search error:", error);
    return new Response(
      JSON.stringify({ error: "Errore durante la ricerca. Riprova più tardi." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
