export const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
export const absUrl = (path: string) => `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Turn user input into an absolute http(s) URL, or null if it isn't one.
 * Adds https:// when the scheme is missing ("www.amazon.it/dp/..."),
 * rejects other schemes such as javascript: or data:.
 */
export function normalizeExternalUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** href for a link someone else entered: http(s) only, otherwise undefined (no link). */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  return normalizeExternalUrl(url) ?? undefined;
}
