export function isWishlistDebug(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('debug') === 'wishlist') return true;
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('DEBUG_WISHLIST');
      if (ls === '1' || ls === 'true') return true;
    }
  } catch {}
  return false;
}

export async function withDbDebug<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    if (isWishlistDebug()) {
      console.groupCollapsed(`[DB] ${label}`);
      console.log({ ms, result });
      console.groupEnd();
    }
    return result;
  } catch (error: any) {
    const ms = Math.round(performance.now() - start);
    const info = {
      label,
      ms,
      error: {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      },
    };
    console.error(info);
    if (isWishlistDebug()) {
      console.groupCollapsed(`[DB ERR] ${label}`);
      console.error(info);
      console.groupEnd();
    }
    throw error;
  }
}
