import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** True inside the Android/iOS app, false on the website. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Hosts whose links should open inside the app (Android App Links). */
const APP_HOSTS = new Set(['amicosegreto.fun', 'www.amicosegreto.fun']);

/**
 * OAuth sign-in. On the website this is a normal redirect. In the app,
 * Google (and others) refuse to sign in inside an embedded WebView, so the
 * provider page opens in the system browser and comes back through an
 * Android App Link to https://amicosegreto.fun/auth (handled below).
 */
export async function signInWithOAuthProvider(provider: Provider, redirectTo: string) {
  if (!isNativeApp()) {
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  }

  const result = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (!result.error && result.data?.url) {
    await Browser.open({ url: result.data.url, presentationStyle: 'popover' });
  }
  return result;
}

/** Complete a sign-in from an auth redirect URL (PKCE code or implicit tokens). */
async function completeAuthFromUrl(url: URL): Promise<void> {
  const code = url.searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

/**
 * Handle links that open the app (invite links, magic links, OAuth returns)
 * and the Android back button. Returns a cleanup function.
 */
export function initNativeApp(navigate: (path: string) => void): () => void {
  if (!isNativeApp()) return () => {};

  const urlListener = App.addListener('appUrlOpen', async ({ url }: URLOpenListenerEvent) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (!APP_HOSTS.has(parsed.hostname)) return;

    try {
      if (parsed.pathname === '/auth') {
        await completeAuthFromUrl(parsed);
        await Browser.close().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to complete sign-in from link:', error);
    }

    // Keep only path + query in the app; tokens in the hash are already consumed.
    const params = new URLSearchParams(parsed.search);
    params.delete('code');
    const query = params.toString();
    navigate(`${parsed.pathname}${query ? `?${query}` : ''}`);
  });

  const backListener = App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });

  return () => {
    urlListener.then((l) => l.remove());
    backListener.then((l) => l.remove());
  };
}
