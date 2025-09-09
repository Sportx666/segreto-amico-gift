export function isDbTrace(): boolean {
  return import.meta.env.VITE_DB_TRACE === "1";
}

export function classifyDbError(err?: { 
  code?: string; 
  message?: string; 
  details?: string; 
  hint?: string 
}): {
  type: 'rls' | 'permission' | 'unique' | 'auth' | 'network' | 'other';
  code?: string; 
  message?: string;
} {
  if (!err) return { type: 'other' };

  const { code, message = '', details = '' } = err;
  const combined = `${message} ${details}`.toLowerCase();

  // RLS/permission errors
  if (code === '42501' || 
      combined.includes('row level security') || 
      combined.includes('permission denied') || 
      combined.includes('violates row-level security')) {
    return { type: 'rls', code, message };
  }

  // Unique constraint violations
  if (code === '23505') {
    return { type: 'unique', code, message };
  }

  // Auth errors
  if (combined.includes('jwt') || 
      combined.includes('auth') || 
      combined.includes('anonymous')) {
    return { type: 'auth', code, message };
  }

  // Network errors
  if (combined.includes('fetch failed') || 
      combined.includes('failed to fetch') || 
      combined.includes('networkerror')) {
    return { type: 'network', code, message };
  }

  return { type: 'other', code, message };
}

export async function withDbTrace<T>(
  label: string, 
  run: () => Promise<T>, 
  meta?: Record<string, any>
): Promise<T> {
  const enabled = isDbTrace();
  const t0 = performance.now();
  let out: any;
  let err: any;

  try {
    out = await run();
    return out;
  } catch (e: any) {
    err = e;
    throw e;
  } finally {
    if (!enabled) return;

    const ms = Math.round(performance.now() - t0);
    const res = out ?? {};
    const errorObj = res?.error ? {
      code: res.error.code,
      message: res.error.message,
      details: res.error.details,
      hint: res.error.hint
    } : (err ? { code: err.code, message: err.message } : null);

    const kind = classifyDbError(errorObj || undefined);
    
    const trace = {
      ts: new Date().toISOString(),
      label,
      ms,
      status: res?.status ?? undefined,
      hasData: Boolean(res?.data && (Array.isArray(res.data) ? res.data.length : true)),
      kind,
      error: errorObj,
      meta
    };

    if (kind?.type === 'rls' || kind?.type === 'permission') {
      console.groupCollapsed(`[DBTRACE][RLS?] ${label} ${ms}ms`);
      console.table(trace);
      console.groupEnd();
    } else {
      console.debug('[DBTRACE]', trace);
    }
  }
}