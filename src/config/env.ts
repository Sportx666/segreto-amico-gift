/**
 * Central environment configuration module
 * Single source of truth for all environment variables
 */

// Helper to safely get client env vars
const getClientEnv = (key: string, defaultValue?: string): string | undefined => {
  if (typeof window === 'undefined') return defaultValue;
  return import.meta.env[key] || defaultValue;
};

// Helper to safely get server env vars
const getServerEnv = (key: string, defaultValue?: string): string | undefined => {
  if (typeof process === 'undefined') return defaultValue;
  return process.env[key] || defaultValue;
};

// Helper for deprecation warnings (dev/uat only)
const warnDeprecated = (oldName: string, newName: string, currentEnv: string) => {
  if (currentEnv === 'production') return;
  console.warn(`[env] DEPRECATED: ${oldName} is deprecated, use ${newName} instead`);
};

// Determine current environment
const getCurrentEnv = (): 'development' | 'uat' | 'production' => {
  // Server-side check first
  const serverEnv = getServerEnv('APP_ENV');
  if (serverEnv) return serverEnv as any;
  
  // Client-side fallback
  const clientEnv = getClientEnv('VITE_APP_ENV');
  if (clientEnv) return clientEnv as any;
  
  // Auto-detect based on domain/host
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('uat') || host.includes('staging')) return 'uat';
    if (host === 'localhost' || host.startsWith('127.')) return 'development';
  }
  
  return 'production';
};

const currentEnv = getCurrentEnv();

// Back-compat shim for deprecated variables
const handleBackCompat = () => {
  // Handle deprecated Supabase anon key naming
  const oldAnonKey = getClientEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
  const newAnonKey = getClientEnv('VITE_SUPABASE_ANON_KEY');
  if (oldAnonKey && !newAnonKey && currentEnv !== 'production') {
    warnDeprecated('VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', currentEnv);
  }
  
  // Handle deprecated Amazon partner tag
  const oldPartnerTag = getClientEnv('VITE_AMAZON_PARTNER_TAG');
  if (oldPartnerTag && currentEnv !== 'production') {
    warnDeprecated('VITE_AMAZON_PARTNER_TAG', 'server-side AMZ_ASSOC_TAG', currentEnv);
  }
};

// Initialize back-compat warnings
handleBackCompat();

// Main configuration object
export const config = {
  app: {
    baseUrl: getClientEnv('VITE_PUBLIC_BASE_URL') || 
             (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
    env: currentEnv
  },
  
  supabase: {
    url: getClientEnv('VITE_SUPABASE_URL') || '',
    anonKey: getClientEnv('VITE_SUPABASE_ANON_KEY') || 
             getClientEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || '', // Back-compat
    serviceRoleKey: getServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
    serverUrl: getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL')
  },
  
  i18n: {
    enabled: getClientEnv('VITE_I18N_ENABLED', '1') !== '0' && 
             getClientEnv('VITE_I18N_ENABLED') !== 'false'
  },
  
  ads: {
    enabled: getClientEnv('VITE_ADS_ENABLED') === '1' || 
             getClientEnv('VITE_ADS_ENABLED') === 'true',
    provider: (getClientEnv('VITE_ADS_ENABLED') === '1' || 
               getClientEnv('VITE_ADS_ENABLED') === 'true') ? 'adsense' as const : 'none' as const,
    adsenseClientId: getClientEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-9283228458809671')
  },
  
  catalog: {
    provider: (getServerEnv('CATALOG_PROVIDER') || 'none') as 'rainforest' | 'serpapi' | 'paapi' | 'oglink' | 'none',
    amazonDomain: getServerEnv('AMAZON_DOMAIN', 'amazon.it'),
    rainforestApiKey: getServerEnv('RAINFOREST_API_KEY'),
    rainforestDomain: getServerEnv('RAINFOREST_DOMAIN', 'amazon.it'),
    // Amazon PA-API
    amazonApiEnabled: getServerEnv('AMAZON_API_ENABLED') === 'true',
    amzAccessKey: getServerEnv('AMZ_ACCESS_KEY'),
    amzSecretKey: getServerEnv('AMZ_SECRET_KEY'),
    amzAssocTag: getServerEnv('AMZ_ASSOC_TAG'),
    amzRegion: getServerEnv('AMZ_REGION', 'eu-west-1')
  },
  
  email: {
    provider: getServerEnv('MAIL_PROVIDER', 'none') as 'resend' | 'sendgrid' | 'none',
    fromEmail: getServerEnv('MAIL_FROM'),
    apiKey: getServerEnv('MAIL_API_KEY') || 
            getServerEnv('RESEND_API_KEY') || 
            getServerEnv('SENDGRID_API_KEY') // Back-compat
  },
  
  auth: {
    redirectOverride: getClientEnv('VITE_AUTH_REDIRECT_OVERRIDE'),
    baseUrl: getServerEnv('PUBLIC_BASE_URL') || getClientEnv('VITE_PUBLIC_BASE_URL')
  },
  
  debug: {
    chatTrace: getClientEnv('VITE_CHAT_TRACE') === '1' || 
               getClientEnv('VITE_CHAT_TRACE') === 'true',
    dbTrace: getClientEnv('VITE_DB_TRACE') === '1' || 
             getClientEnv('VITE_DB_TRACE') === 'true'
  },
  
  devFlags: {
    allowUnauthDraw: getServerEnv('DEV_ALLOW_UNAUTH_DRAW') === '1'
  }
} as const;

// Type exports for external use
export type Config = typeof config;
export type AppEnv = typeof config.app.env;
export type CatalogProvider = typeof config.catalog.provider;
export type EmailProvider = typeof config.email.provider;
export type AdsProvider = typeof config.ads.provider;

// Validation helper
export const validateRequiredConfig = () => {
  const errors: string[] = [];
  
  if (!config.supabase.url) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  
  if (!config.supabase.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }
  
  if (config.ads.enabled && !config.ads.adsenseClientId) {
    errors.push('VITE_ADSENSE_CLIENT_ID is required when ads are enabled');
  }
  
  if (config.catalog.provider === 'rainforest' && !config.catalog.rainforestApiKey) {
    errors.push('RAINFOREST_API_KEY is required when catalog provider is rainforest');
  }
  
  if (config.catalog.provider === 'paapi') {
    if (!config.catalog.amzAccessKey) errors.push('AMZ_ACCESS_KEY is required for PA-API');
    if (!config.catalog.amzSecretKey) errors.push('AMZ_SECRET_KEY is required for PA-API');
    if (!config.catalog.amzAssocTag) errors.push('AMZ_ASSOC_TAG is required for PA-API');
  }
  
  if (config.email.provider === 'resend' && !config.email.apiKey) {
    errors.push('MAIL_API_KEY or RESEND_API_KEY is required when email provider is resend');
  }
  
  if (config.email.provider === 'sendgrid' && !config.email.apiKey) {
    errors.push('MAIL_API_KEY or SENDGRID_API_KEY is required when email provider is sendgrid');
  }
  
  return errors;
};

// Development helper
if (currentEnv === 'development') {
  const errors = validateRequiredConfig();
  if (errors.length > 0) {
    console.warn('[env] Configuration warnings:', errors);
  }
}