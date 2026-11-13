import { Capacitor } from '@capacitor/core';

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
  // Never inside the Android/iOS app: AdSense does not allow ads in app WebViews.
  ads: import.meta.env.VITE_ADS_ENABLED === 'true' && !Capacitor.isNativePlatform(),

  /**
   * Native push notifications. Off until Firebase (google-services.json) and the
   * FCM HTTP v1 sender are set up: registering without Firebase crashes on Android.
   * Set VITE_PUSH_ENABLED=true at build time to enable.
   */
  nativePush: import.meta.env.VITE_PUSH_ENABLED === 'true',

  /**
   * Enable/disable internationalization (i18n)
   * Set VITE_I18N_ENABLED=true in .env to enable
   * When disabled, Italian is used as the default language
   */
  i18n: import.meta.env.VITE_I18N_ENABLED !== 'false',

  /**
   * Pinterest Tag ID (public). Empty string disables Pinterest tracking.
   * Set VITE_PINTEREST_TAG_ID in .env / build env.
   */
  pinterestTagId: (import.meta.env.VITE_PINTEREST_TAG_ID as string | undefined) ?? '',
} as const;

// Type for feature flag keys
export type FeatureFlagKey = keyof typeof featureFlags;

// Helper to check if a feature is enabled
export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => {
  return Boolean(featureFlags[flag]);
};
