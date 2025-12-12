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
  const config = MARKETPLACE_CONFIG[marketplace] || MARKETPLACE_CONFIG.IT;
  console.log(`Using marketplace: ${marketplace} -> ${config.domain}`);
  return config;
}

function getAffiliateTag(): string {
  const tag = Deno.env.get("AMZ_ASSOC_TAG") || Deno.env.get("RAINFOREST_ASSOC_TAG") || "yourtag-21";
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

        const items: CatalogItem[] = ((data as any).search_results || []).map((item: any) => {
          const asin = item.asin || extractAsinFromUrl(item.link);
          const baseUrl = asin ? `https://www.${this.domain}/dp/${asin}` : item.link;
          return {
            title: item.title || "Unknown Title",
            imageUrl: item.image,
            asin,
            url: withAffiliateTag(baseUrl),
            price: item.price?.value ? String(item.price.value) : undefined,
            currency: item.price?.currency || getMarketplaceConfig().currency,
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

function extractAsinFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match?.[1];
}

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
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
      return new Response(
        JSON.stringify({ items: cached.items, total: cached.total, page: Number(page), pageSize: 10, cached: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // No provider configured
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
