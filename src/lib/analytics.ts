// Lightweight Plausible wrapper. Safe no-op when the script hasn't loaded
// (or is blocked) — calls are queued by the snippet in index.html.

declare global {
  interface Window {
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number | boolean>; callback?: () => void }
    ) => void;
  }
}

export type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: string, props?: AnalyticsProps): void {
  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {
    // ignore — analytics must never break the app
  }
}
