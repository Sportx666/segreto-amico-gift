import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
const REQUEST_TIMEOUT = Number(Deno.env.get('RAINFOREST_TIMEOUT_MS') || 25000); // configurable timeout

async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - startTime;
      console.log(`Attempt ${attempt} succeeded in ${elapsed}ms`);
      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.log(`Attempt ${attempt} failed after ${elapsed}ms:`, error?.message || error);
      
      if (attempt === maxAttempts) throw error;
      
      // Retry on timeout, network errors, or 5xx responses
      const shouldRetry = error?.name === 'AbortError' || 
                         error?.message?.includes('timeout') ||
                         error?.message?.includes('network') ||
                         (error?.message?.includes('Rainforest API error') && error?.message?.match(/5\d\d/));
      
      if (!shouldRetry) throw error;
      
      // Exponential backoff: 800ms, 1600ms
      const delay = 800 * attempt;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max attempts reached');
}

class RainforestClient {
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string, domain: string = "amazon.it") {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  async search(query: string, page: number = 1, minPrice?: number, maxPrice?: number): Promise<{ items: CatalogItem[]; total: number }> {
    return withRetry(async () => {
      const url = "https://api.rainforestapi.com/request";
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
        const response = await fetch(`${url}?${params}`, {
          signal: controller.signal,
          headers: { 
            "User-Agent": "AmiciSegreto/1.0",
            "Accept": "application/json"
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) throw new Error("API_RATE_LIMIT");
          throw new Error(`Rainforest API error: ${response.status}`);
        }

        const data = await response.json();
        if ((data as any).error) throw new Error((data as any).error);

        let items: CatalogItem[] = ((data as any).search_results || []).map((item: any) => {
          const asin = item.asin || extractAsinFromUrl(item.link);
          return {
            title: item.title || "Unknown Title",
            imageUrl: item.image,
            asin,
            url: asin ? `https://www.${this.domain}/dp/${asin}` : item.link,
            price: item.price?.value ? String(item.price.value) : undefined,
            currency: item.price?.currency || "EUR",
          } as CatalogItem;
        });

        if (minPrice !== undefined || maxPrice !== undefined) {
          items = sortItemsByPrice(items, true);
        }

        return {
          items,
          total: (data as any).pagination?.total_results || items.length,
        };
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

function sortItemsByPrice(items: CatalogItem[], ascending: boolean = true): CatalogItem[] {
  return items.sort((a, b) => {
    const priceA = parseFloat(a.price || "0");
    const priceB = parseFloat(b.price || "0");
    return ascending ? priceA - priceB : priceB - priceA;
  });
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
    const { q = "", page = 1, minPrice, maxPrice } = body as {
      q?: string;
      page?: number;
      minPrice?: number;
      maxPrice?: number;
    };

    const query = String(q || "").trim();
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing search query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `search:${query}:${page}:${minPrice || ""}:${maxPrice || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(
        JSON.stringify({ items: cached.items, total: cached.total, page: Number(page), pageSize: 10, cached: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = Deno.env.get("CATALOG_PROVIDER");
    console.log("CATALOG_PROVIDER:", provider);
    console.log("Available env vars:", Object.keys(Deno.env.toObject()).filter(key => key.includes('CATALOG') || key.includes('RAINFOREST')));
    console.log("REQUEST_TIMEOUT:", REQUEST_TIMEOUT + "ms");
    
    if (provider === "rainforest") {
      const apiKey = Deno.env.get("RAINFOREST_API_KEY");
      const domain = Deno.env.get("RAINFOREST_DOMAIN") || "amazon.it";
      console.log("RAINFOREST_API_KEY present:", !!apiKey);
      console.log("RAINFOREST_DOMAIN:", domain);

      if (!apiKey) {
        console.warn("RAINFOREST_API_KEY not found in environment");
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile. Riprova più tardi." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        const client = new RainforestClient(apiKey, domain);
        const result = await client.search(query, Number(page), minPrice, maxPrice);
        cache.set(cacheKey, { ...result, timestamp: Date.now() });

        return new Response(
          JSON.stringify({ items: result.items, total: result.total, page: Number(page), pageSize: 10, provider: "rainforest" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error: any) {
        console.error("Rainforest API error:", error?.message || error);
        if (error?.message === "API_RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Limite di ricerche raggiunto. Riprova tra qualche minuto." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ error: "Servizio di ricerca temporaneamente non disponibile. Riprova più tardi." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Servizio di ricerca non configurato. Contatta il supporto." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Catalog search error:", error);
    return new Response(
      JSON.stringify({ error: "Si è verificato un errore durante la ricerca. Riprova tra qualche minuto." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});