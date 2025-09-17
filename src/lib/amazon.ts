// Centralized Amazon affiliate tag configuration and utilities
const FALLBACK_PARTNER_TAG = 'yourtag-21'; // Fallback if no env is set

/**
 * Gets the Amazon affiliate tag from environment or returns fallback
 * Validates that the tag is set in production builds
 */
export function getAffiliateTag(): string {
  // In production, we should have a proper tag configured
  const isProduction = import.meta.env.PROD;
  const tag = FALLBACK_PARTNER_TAG; // Client-side uses constant
  
  if (isProduction && tag === FALLBACK_PARTNER_TAG) {
    console.warn('⚠️ Amazon affiliate tag not properly configured for production');
  }
  
  return tag;
}

/**
 * Adds Amazon affiliate tag to any Amazon URL
 * Centralizes affiliate link generation across the application
 */
export function withAffiliateTag(url: string, customTag?: string): string {
  try {
    const amazonUrl = new URL(url);
    
    // Only process Amazon URLs
    if (!amazonUrl.hostname.includes('amazon.')) {
      return url;
    }
    
    // Use custom tag or get from environment
    const tag = customTag || getAffiliateTag();
    
    // Add or update the tag parameter
    amazonUrl.searchParams.set('tag', tag);
    
    return amazonUrl.toString();
  } catch (error) {
    console.warn('Invalid URL provided to withAffiliateTag:', url);
    return url;
  }
}

/**
 * Generates Amazon product URL from ASIN with affiliate tag
 * Includes SEO-friendly slug if title is provided
 */
export function productUrlFromASIN(asin: string, title?: string): string {
  const slug = title 
    ? title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 50)
    : '';
  
  const baseUrl = `https://www.amazon.it/dp/${asin}`;
  const urlWithSlug = slug ? `${baseUrl}/${slug}` : baseUrl;
  
  return withAffiliateTag(urlWithSlug);
}

/**
 * Generates Amazon search URL for budget-based gift ideas with affiliate tag
 */
export function ideaBucketUrl(budget: number, topic: string = "idee regalo"): string {
  const query = `${topic} sotto ${budget} euro`.replace(/\s+/g, '+');
  const baseUrl = `https://www.amazon.it/s?k=${query}`;
  
  return withAffiliateTag(baseUrl);
}