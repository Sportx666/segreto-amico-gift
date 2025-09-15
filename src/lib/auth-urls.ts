/**
 * Centralized authentication URL management
 * Handles redirect URLs for all authentication flows with environment-based overrides
 */
import { config } from '@/config/env';

/**
 * Gets the base URL for authentication redirects
 * Priority: VITE_AUTH_REDIRECT_OVERRIDE > VITE_PUBLIC_BASE_URL > window.location.origin
 */
export function getAuthBaseUrl(): string {
  // 1. Check for explicit override (highest priority)
  const override = config.auth.redirectOverride;
  if (override) {
    return override.replace(/\/$/, ''); // Remove trailing slash
  }

  // 2. Check for public base URL (development/staging)
  const baseUrl = config.app.baseUrl;
  if (baseUrl && baseUrl !== window.location.origin) {
    return baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  // 3. Fall back to current origin (production)
  return window.location.origin;
}

/**
 * Generates auth redirect URL for the current auth flow
 * @param next - The path to redirect to after successful authentication
 * @returns Complete redirect URL for Supabase auth
 */
export function getAuthRedirectUrl(next: string = '/'): string {
  const baseUrl = getAuthBaseUrl();
  const encodedNext = encodeURIComponent(next);
  return `${baseUrl}/auth?next=${encodedNext}`;
}

/**
 * Generates magic link redirect URL
 * @param next - The path to redirect to after successful authentication
 * @returns Complete redirect URL for magic link authentication
 */
export function getMagicLinkRedirectUrl(next: string = '/'): string {
  return getAuthRedirectUrl(next);
}

/**
 * Generates OAuth redirect URL
 * @param next - The path to redirect to after successful authentication  
 * @returns Complete redirect URL for OAuth authentication
 */
export function getOAuthRedirectUrl(next: string = '/'): string {
  return getAuthRedirectUrl(next);
}