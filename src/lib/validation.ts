/**
 * Environment validation utilities
 * Checks for required configuration in production builds
 */

import { getAffiliateTag } from './amazon';

/**
 * Validates that critical environment configuration is properly set
 * Should be called during application initialization
 */
export function validateEnvironment(): void {
  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;
  
  if (isProduction) {
    // Check affiliate tag configuration
    const tag = getAffiliateTag();
    if (tag === 'yourtag-21') {
      console.warn(
        '⚠️ PRODUCTION WARNING: Amazon affiliate tag not configured!\n' +
        'Set AMZ_ASSOC_TAG, AMAZON_PAAPI_PARTNER_TAG, or RAINFOREST_ASSOC_TAG in your environment variables.\n' +
        'Using fallback tag "yourtag-21" which should be replaced.'
      );
    } else {
      console.info('✅ Amazon affiliate tag configured:', tag);
    }
  }
  
  if (isDevelopment) {
    console.info('🔧 Development mode: Using fallback affiliate configuration');
  }
}

/**
 * Client-side environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    mode: import.meta.env.MODE,
    prod: import.meta.env.PROD,
    dev: import.meta.env.DEV,
    affiliateTag: getAffiliateTag(),
    hasValidTag: getAffiliateTag() !== 'yourtag-21'
  };
}