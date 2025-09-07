export function isDebug(): boolean {
  // 1) URL param has highest priority: ?debug=1 enables, ?debug=0 disables
  try {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      const qp = qs.get('debug');
      if (qp === '1' || qp === 'true') return true;
      if (qp === '0' || qp === 'false') return false;
    }
  } catch {}

  // 2) localStorage override
  try {
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('debug');
      if (ls === '1' || ls === 'true') return true;
      if (ls === '0' || ls === 'false') return false;
    }
  } catch {}

  // 3) Vite env: VITE_DEBUG toggles; otherwise default to DEV
  try {
    const env = (import.meta as any)?.env ?? {};
    if (env?.VITE_DEBUG === '1' || env?.VITE_DEBUG === 'true') return true;
    if (env?.VITE_DEBUG === '0' || env?.VITE_DEBUG === 'false') return false;
    if (env?.DEV) return true;
  } catch {}

  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debugLog(scope: string, payload?: any): void {
  if (!isDebug()) return;
  try {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[DEBUG] ${scope}`);
    // eslint-disable-next-line no-console
    console.log(payload);
    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch {}
}

export function initDebug(): void {
  if (!isDebug()) return;
  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        // eslint-disable-next-line no-console
        console.error('[GlobalError]', e.error ?? e.message);
      });
      window.addEventListener('unhandledrejection', (e) => {
        // eslint-disable-next-line no-console
        console.error('[UnhandledRejection]', (e as any).reason);
      });
    }
  } catch {}
}
