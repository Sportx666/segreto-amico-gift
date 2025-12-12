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
//   - "rainforest" = Use Rainforest API (recommended)
//   - "mock" = Return mock data for testing
//
// Switch marketplaces by setting: AMAZON_MARKETPLACE
//   - "IT", "US", "UK", "DE", "FR", "ES"
//
// Required secrets for each provider:
//   rainforest: RAINFOREST_API_KEY
//   all: AMZ_ASSOC_TAG (affiliate tag)
// ============================================================

const MARKETPLACE_CONFIG: Record<string, { domain: string; currency: string }> = {
  IT: { domain: 'amazon.it', currency: 'EUR' },
  US: { domain: 'amazon.com', currency: 'USD' },
  UK: { domain: 'amazon.co.uk', currency: 'GBP' },
  DE: { domain: 'amazon.de', currency: 'EUR' },
  FR: { domain: 'amazon.fr', currency: 'EUR' },
  ES: { domain: 'amazon.es', currency: 'EUR' },
};

function getMarketplaceConfig() {
  const marketplace = Deno.env.get('AMAZON_MARKETPLACE') || 'IT';
  return MARKETPLACE_CONFIG[marketplace] || MARKETPLACE_CONFIG.IT;
}

function getAffiliateTag(): string {
  return Deno.env.get("AMZ_ASSOC_TAG") || Deno.env.get("RAINFOREST_ASSOC_TAG") || "yourtag-21";
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
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const REQUEST_TIMEOUT = 10000;

class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.domain = getMarketplaceConfig().domain;
  }

  async getProduct(asin: string): Promise<CatalogItem> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      type: "product",
      amazon_domain: this.domain,
      asin: asin,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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
        currency: product.buybox_winner?.price?.currency || getMarketplaceConfig().currency,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === "AbortError") throw new Error("Request timeout");
      throw error;
    }
  }
}

function getMockProduct(asin: string): CatalogItem {
  const config = getMarketplaceConfig();
  return {
    title: `Prodotto Mock ${asin}`,
    imageUrl: `https://via.placeholder.com/400?text=${asin}`,
    asin: asin,
    url: withAffiliateTag(`https://www.${config.domain}/dp/${asin}`),
    price: "29.99",
    currency: config.currency,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { asin } = body as { asin?: string };

    if (!asin || typeof asin !== "string" || !/^[A-Z0-9]{10}$/i.test(asin)) {
      return new Response(JSON.stringify({ error: "Valid ASIN required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache
    const cacheKey = `item:${asin}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({ item: cached.item, cached: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = Deno.env.get("CATALOG_PROVIDER");
    console.log(`CATALOG_PROVIDER: ${provider}, AMAZON_MARKETPLACE: ${Deno.env.get('AMAZON_MARKETPLACE') || 'IT'}`);

    // Provider: mock
    if (provider === "mock") {
      const item = getMockProduct(asin);
      cache.set(cacheKey, { item, timestamp: Date.now() });
      return new Response(JSON.stringify({ item, provider: "mock", mock: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Provider: rainforest
    if (provider === "rainforest") {
      const apiKey = Deno.env.get("RAINFOREST_API_KEY");
      if (!apiKey) {
        console.warn("RAINFOREST_API_KEY not configured, using mock");
        const item = getMockProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return new Response(JSON.stringify({ item, mock: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const client = new RainforestClient(apiKey);
        const item = await client.getProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return new Response(JSON.stringify({ item, provider: "rainforest" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("Rainforest error:", error?.message);
        if (error?.message === "API_RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Limite richieste raggiunto. Riprova tra qualche minuto." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Fallback to mock on error
        const item = getMockProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return new Response(JSON.stringify({ item, mock: true, fallback: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // No provider or unknown - return mock
    const item = getMockProduct(asin);
    cache.set(cacheKey, { item, timestamp: Date.now() });
    return new Response(JSON.stringify({ item, mock: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Catalog item error:", error);
    return new Response(
      JSON.stringify({ error: "Errore durante il caricamento del prodotto." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
