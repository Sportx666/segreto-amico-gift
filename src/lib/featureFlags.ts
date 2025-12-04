/**
 * Centralized feature flags configuration
 * 
 * All feature toggles should be defined here for consistent access across the app.
 * Environment variables are read once at module load time.
 */

export const featureFlags = {
  /**
   * Enable/disable Google AdSense ads
   * Set VITE_ADS_ENABLED=true in .env to enable
   */
  ads: import.meta.env.VITE_ADS_ENABLED === 'true',

  /**
   * Enable/disable internationalization (i18n)
   * Set VITE_I18N_ENABLED=true in .env to enable
   * When disabled, Italian is used as the default language
   */
  i18n: import.meta.env.VITE_I18N_ENABLED !== 'false',
} as const;

// Type for feature flag keys
export type FeatureFlagKey = keyof typeof featureFlags;

// Helper to check if a feature is enabled
export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => {
  return featureFlags[flag];
};
