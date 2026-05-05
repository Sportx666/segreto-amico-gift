/**
 * Pinterest Tag helper - centralized access to window.pintrk
 * Tag ID is read from VITE_PINTEREST_TAG_ID. If empty, all calls are no-ops.
 */

export const PINTEREST_TAG_ID =
  (import.meta.env.VITE_PINTEREST_TAG_ID as string | undefined) ?? '';

type PintrkProps = Record<string, unknown>;

function pintrk(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  const fn = (window as any).pintrk;
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch {
    /* no-op */
  }
}

/** Initialize / re-initialize the tag, optionally with Enhanced Match email. */
export function pinterestLoad(email?: string | null): void {
  if (!PINTEREST_TAG_ID) return;
  if (email) {
    pintrk('load', PINTEREST_TAG_ID, { em: email });
  } else {
    pintrk('load', PINTEREST_TAG_ID);
  }
  pintrk('page');
}

/** Track a Pinterest conversion event (e.g., 'pagevisit', 'signup', 'lead'). */
export function pinterestTrack(event: string, props?: PintrkProps): void {
  if (!PINTEREST_TAG_ID) return;
  if (props) {
    pintrk('track', event, props);
  } else {
    pintrk('track', event);
  }
}
