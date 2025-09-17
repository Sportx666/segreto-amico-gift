import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Server-side Amazon affiliate tag utilities
 * Gets tags from Supabase secrets (AMZ_ASSOC_TAG or RAINFOREST_ASSOC_TAG)
 */
function getAffiliateTag(): string {
  // Check for Rainforest-specific tag first, then fallback to main Amazon tag
  const rainforestTag = Deno.env.get("RAINFOREST_ASSOC_TAG");
  const mainTag = Deno.env.get("AMZ_ASSOC_TAG");
  const fallbackTag = "yourtag-21";
  
  const tag = rainforestTag || mainTag || fallbackTag;
  
  // Warn in production if using fallback
  if (tag === fallbackTag) {
    console.warn("⚠️ Amazon affiliate tag not configured, using fallback");
  }
  
  return tag;
}

/**
 * Adds Amazon affiliate tag to URLs
 */
function withAffiliateTag(url: string): string {
  try {
    const amazonUrl = new URL(url);
    
    // Only process Amazon URLs
    if (!amazonUrl.hostname.includes('amazon.')) {
      return url;
    }
    
    // Add affiliate tag
    amazonUrl.searchParams.set('tag', getAffiliateTag());
    return amazonUrl.toString();
  } catch (error) {
    console.warn('Invalid URL provided to withAffiliateTag:', url);
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
const REQUEST_TIMEOUT = 10000; // 10 seconds

class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string, domain: string = "amazon.it") {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  async getProduct(asin: string): Promise<CatalogItem> {
    const url = "https://api.rainforestapi.com/request";
    const params = new URLSearchParams({
      api_key: this.apiKey,
      type: "product",
      amazon_domain: this.domain,
      asin: asin,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${url}?${params}`, {
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
        currency: product.buybox_winner?.price?.currency || "EUR",
      } as CatalogItem;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === "AbortError") throw new Error("Request timeout");
      throw error;
    }
  }
}

function getMockProduct(asin: string): CatalogItem {
  return {
    title: `Prodotto ${asin}`,
    imageUrl: `https://via.placeholder.com/400?text=${asin}`,
    asin: asin,
    url: withAffiliateTag(`https://www.amazon.it/dp/${asin}`),
    price: "29.99",
    currency: "EUR",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { asin } = body as { asin?: string };

    if (!asin || typeof asin !== "string" || !/^[A-Z0-9]{10}$/i.test(asin)) {
      return new Response(JSON.stringify({ error: "Valid ASIN required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `item:${asin}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({ item: cached.item, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = Deno.env.get("CATALOG_PROVIDER");

    if (provider === "rainforest") {
      const apiKey = Deno.env.get("RAINFOREST_API_KEY");
      const domain = Deno.env.get("RAINFOREST_DOMAIN") || "amazon.it";

      if (!apiKey) {
        console.warn("RAINFOREST_API_KEY not configured, falling back to mock data");
        const mockItem = getMockProduct(asin);
        cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
        return new Response(JSON.stringify({ item: mockItem, mock: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const client = new RainforestClient(apiKey, domain);
        const item = await client.getProduct(asin);
        cache.set(cacheKey, { item, timestamp: Date.now() });
        return new Response(JSON.stringify({ item, provider: "rainforest" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("Rainforest API error:", error?.message || error);
        if (error?.message === "API_RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Limite di richieste raggiunto. Riprova tra qualche minuto.", fallback: true }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.warn("Falling back to mock data due to API error");
        const mockItem = getMockProduct(asin);
        cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
        return new Response(JSON.stringify({ item: mockItem, mock: true, fallback: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const mockItem = getMockProduct(asin);
    cache.set(cacheKey, { item: mockItem, timestamp: Date.now() });
    return new Response(JSON.stringify({ item: mockItem, mock: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Catalog item error:", error);
    return new Response(
      JSON.stringify({ error: "Si è verificato un errore durante il caricamento del prodotto. Riprova tra qualche minuto." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});