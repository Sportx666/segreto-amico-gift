import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// UNIFIED CATALOG PROVIDER CONFIGURATION (mirrors catalog-search)
// CATALOG_PROVIDER: "amazon" | "rainforest" | "mock"
// ============================================================
const MARKETPLACE_CONFIG: Record<string, { domain: string; currency: string; host: string; region: string }> = {
  IT: { domain: 'amazon.it', currency: 'EUR', host: 'webservices.amazon.it', region: 'eu-west-1' },
  US: { domain: 'amazon.com', currency: 'USD', host: 'webservices.amazon.com', region: 'us-east-1' },
  UK: { domain: 'amazon.co.uk', currency: 'GBP', host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  DE: { domain: 'amazon.de', currency: 'EUR', host: 'webservices.amazon.de', region: 'eu-west-1' },
  FR: { domain: 'amazon.fr', currency: 'EUR', host: 'webservices.amazon.fr', region: 'eu-west-1' },
  ES: { domain: 'amazon.es', currency: 'EUR', host: 'webservices.amazon.es', region: 'eu-west-1' },
};

const CONFIG = (() => {
  const marketplaceCode = Deno.env.get('AMAZON_MARKETPLACE') || 'IT';
  const mp = MARKETPLACE_CONFIG[marketplaceCode] || MARKETPLACE_CONFIG.IT;
  const effectiveMarketplace = MARKETPLACE_CONFIG[marketplaceCode] ? marketplaceCode : 'IT';

  const amzTag = Deno.env.get("AMZ_ASSOC_TAG");
  const paapiTag = Deno.env.get("AMAZON_PAAPI_PARTNER_TAG");
  const rainforestTag = Deno.env.get("RAINFOREST_ASSOC_TAG");
  const affiliateTag = amzTag || paapiTag || rainforestTag || "yourtag-21";

  if (affiliateTag === "yourtag-21") {
    console.warn("⚠️ Amazon affiliate tag not configured, using fallback");
  }

  const provider = Deno.env.get("CATALOG_PROVIDER") || "";
  const rainforestApiKey = Deno.env.get("RAINFOREST_API_KEY") || "";
  const amazonAccessKey = Deno.env.get("AMAZON_PAAPI_ACCESS_KEY") || "";
  const amazonSecretKey = Deno.env.get("AMAZON_PAAPI_SECRET_KEY") || "";
  const amazonRegion = Deno.env.get("AMAZON_PAAPI_REGION") || mp.region;
  const timeout = Number(Deno.env.get('RAINFOREST_TIMEOUT_MS') || 15000);

  console.log(`catalog-item config: provider=${provider}, marketplace=${effectiveMarketplace} -> ${mp.domain}`);

  return {
    provider,
    marketplace: { ...mp, code: effectiveMarketplace },
    affiliateTag,
    rainforestApiKey,
    amazon: {
      accessKey: amazonAccessKey,
      secretKey: amazonSecretKey,
      partnerTag: affiliateTag,
      region: amazonRegion,
      host: mp.host,
    },
    timeout,
  };
})();

const AMAZON_HOST_REGEX = /amazon\./;

function withAffiliateTag(url: string): string {
  try {
    const u = new URL(url);
    if (!AMAZON_HOST_REGEX.test(u.hostname)) return url;
    u.searchParams.set('tag', CONFIG.affiliateTag);
    return u.toString();
  } catch {
    return url;
  }
}

interface CatalogItem {
  title: string;
  imageUrl?: string;
  asin?: string;
  url: string;
  price?: string;
  currency?: string;
}

interface CacheEntry {
  item: CatalogItem;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000;

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// RAINFOREST PROVIDER
// ============================================================
class RainforestClient {
  constructor(private apiKey: string, private domain: string, private currency: string) {}

  async getProduct(asin: string): Promise<CatalogItem> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      type: "product",
      amazon_domain: this.domain,
      asin,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    try {
      const response = await fetch(`https://api.rainforestapi.com/request?${params}`, {
        signal: controller.signal,
        headers: { "User-Agent": "AmiciSegreto/1.0" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) throw new Error("API_RATE_LIMIT");
        throw new Error(`Rainforest API error: ${response.status}`);
      }

      const data = await response.json();
      if ((data as any).error) throw new Error((data as any).error);

      const product = (data as any).product;
      if (!product) throw new Error("Product not found");

      return {
        title: product.title || "Unknown Title",
        imageUrl: product.main_image?.link,
        asin: product.asin,
        url: withAffiliateTag(`https://www.${this.domain}/dp/${product.asin}`),
        price: product.buybox_winner?.price?.value ? String(product.buybox_winner.price.value) : undefined,
        currency: product.buybox_winner?.price?.currency || this.currency,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === "AbortError") throw new Error("Request timeout");
      throw error;
    }
  }
}

// ============================================================
// AMAZON PA-API v5 PROVIDER (GetItems)
// ============================================================
class AmazonPAAPIClient {
  constructor(
    private accessKey: string,
    private secretKey: string,
    private partnerTag: string,
    private host: string,
    private region: string,
    private domain: string,
    private currency: string,
  ) {}

  isConfigured(): boolean {
    return !!(this.accessKey && this.secretKey && this.partnerTag);
  }

  async getProduct(asin: string): Promise<CatalogItem> {
    if (!this.isConfigured()) throw new Error("AMAZON_PAAPI_CREDENTIALS_MISSING");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    try {
      const payload = {
        ItemIds: [asin],
        Resources: [
          "Images.Primary.Large",
          "ItemInfo.Title",
          "Offers.Listings.Price",
        ],
        PartnerTag: this.partnerTag,
        PartnerType: "Associates",
        Marketplace: `www.${this.domain}`,
      };

      const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
      const headers = await this.signRequest("/paapi5/getitems", payload, target);

      const response = await fetch(`https://${this.host}/paapi5/getitems`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Amazon PA-API getitems error: ${response.status}`, errorText.slice(0, 300));
        if (response.status === 429) throw new Error("API_RATE_LIMIT");
        if (response.status === 401 || response.status === 403) throw new Error("AMAZON_PAAPI_AUTH_ERROR");
        throw new Error(`Amazon PA-API error: ${response.status}`);
      }

      const data = await response.json();
      const item = data?.ItemsResult?.Items?.[0];
      if (!item) throw new Error("Product not found");

      const title = item.ItemInfo?.Title?.DisplayValue || "Unknown Title";
      const imageUrl = item.Images?.Primary?.Large?.URL;
      const listing = item.Offers?.Listings?.[0];
      const price = listing?.Price?.Amount != null ? String(listing.Price.Amount) : undefined;
      const currency = listing?.Price?.Currency || this.currency;
      const detailUrl = item.DetailPageURL || `https://www.${this.domain}/dp/${item.ASIN}`;

      return {
        title,
        imageUrl,
        asin: item.ASIN,
        url: withAffiliateTag(detailUrl),
        price,
        currency,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === "AbortError") throw new Error("Request timeout");
      throw error;
    }
  }

  private async signRequest(path: string, payload: any, target: string): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const service = "ProductAdvertisingAPI";

    const canonicalHeaders = [
      `content-encoding:amz-1.0`,
      `content-type:application/json; charset=utf-8`,
      `host:${this.host}`,
      `x-amz-date:${timestamp}`,
      `x-amz-target:${target}`,
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
      "X-Amz-Target": target,
      "Authorization": authorization,
    };
  }

  private async sha256(message: string): Promise<string> {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
    return new Uint8Array(signature);
  }

  private async hmacHex(key: Uint8Array, message: string): Promise<string> {
    const sig = await this.hmacSha256(key, message);
    return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getSignatureKey(dateStamp: string, serviceName: string): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const kDate = await this.hmacSha256(enc.encode("AWS4" + this.secretKey), dateStamp);
    const kRegion = await this.hmacSha256(kDate, this.region);
    const kService = await this.hmacSha256(kRegion, serviceName);
    return await this.hmacSha256(kService, "aws4_request");
  }
}

// Singleton clients
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
      CONFIG.marketplace.currency,
    )
  : null;

function getMockProduct(asin: string): CatalogItem {
  return {
    title: `Prodotto Mock ${asin}`,
    imageUrl: `https://via.placeholder.com/400?text=${asin}`,
    asin,
    url: withAffiliateTag(`https://www.${CONFIG.marketplace.domain}/dp/${asin}`),
    price: "29.99",
    currency: CONFIG.marketplace.currency,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { asin } = body as { asin?: string };

    if (!asin || typeof asin !== "string" || !/^[A-Z0-9]{10}$/i.test(asin)) {
      return jsonResponse({ error: "Valid ASIN required" }, 400);
    }

    const cacheKey = `item:${CONFIG.provider}:${asin}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return jsonResponse({ item: cached.item, provider: CONFIG.provider, cached: true });
    }

    // mock
    if (CONFIG.provider === "mock") {
      const item = getMockProduct(asin);
      cache.set(cacheKey, { item, timestamp: Date.now() });
      return jsonResponse({ item, provider: "mock", mock: true });
    }

    // amazon (PA-API v5)
    if (CONFIG.provider === "amazon") {
      if (!amazonClient || !amazonClient.isConfigured()) {
        console.error("Amazon PA-API credentials not configured");
        return jsonResponse({ error: "Servizio non disponibile." }, 503);
      }
      try {
        const item = await amazonClient.getProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return jsonResponse({ item, provider: "amazon" });
      } catch (error: any) {
        console.error("Amazon PA-API getitems error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return jsonResponse({ error: "Limite richieste raggiunto. Riprova tra qualche minuto." }, 429);
        }
        if (error?.message === "AMAZON_PAAPI_AUTH_ERROR") {
          console.error("Amazon PA-API authentication failed - check credentials");
        }
        const item = getMockProduct(asin);
        return jsonResponse({ item, provider: "amazon", mock: true, fallback: true });
      }
    }

    // rainforest
    if (CONFIG.provider === "rainforest") {
      if (!rainforestClient) {
        console.warn("RAINFOREST_API_KEY not configured, using mock");
        const item = getMockProduct(asin);
        return jsonResponse({ item, mock: true });
      }
      try {
        const item = await rainforestClient.getProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return jsonResponse({ item, provider: "rainforest" });
      } catch (error: any) {
        console.error("Rainforest error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return jsonResponse({ error: "Limite richieste raggiunto. Riprova tra qualche minuto." }, 429);
        }
        const item = getMockProduct(asin);
        return jsonResponse({ item, mock: true, fallback: true });
      }
    }

    // No / unknown provider
    const item = getMockProduct(asin);
    return jsonResponse({ item, mock: true });
  } catch (error) {
    console.error("Catalog item error:", error);
    return jsonResponse({ error: "Errore durante il caricamento del prodotto." }, 500);
  }
});
