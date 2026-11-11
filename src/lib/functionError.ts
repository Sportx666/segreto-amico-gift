/**
 * supabase.functions.invoke puts non-2xx bodies on error.context (a Response)
 * and sets error.message to a generic string. Read the JSON `{ error }` the
 * Edge Functions actually return.
 */
export async function readFunctionError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== 'object') return null;

  const response = context as {
    clone?: () => { text?: () => Promise<string> };
    text?: () => Promise<string>;
  };
  const source = typeof response.clone === 'function' ? response.clone() : response;
  if (typeof source.text !== 'function') return null;

  try {
    const text = (await source.text()).trim();
    if (!text) return null;
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
    } catch {
      return text;
    }
    return text;
  } catch {
    return null;
  }
}
