const VITE_AMAZON_PARTNER_TAG = 'yourtag-21'; // TODO: Replace with actual tag

export function withAffiliateTag(url: string, tag: string = VITE_AMAZON_PARTNER_TAG): string {
  try {
    const amazonUrl = new URL(url);
    
    // Only process Amazon URLs
    if (!amazonUrl.hostname.includes('amazon.')) {
      return url;
    }
    
    // Add or update the tag parameter
    amazonUrl.searchParams.set('tag', tag);
    
    return amazonUrl.toString();
  } catch (error) {
    console.warn('Invalid URL provided to withAffiliateTag:', url);
    return url;
  }
}

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

export function ideaBucketUrl(budget: number, topic: string = "idee regalo"): string {
  const query = `${topic} sotto ${budget} euro`.replace(/\s+/g, '+');
  const baseUrl = `https://www.amazon.it/s?k=${query}`;
  
  return withAffiliateTag(baseUrl);
}