import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL not defined');
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not defined');
  }

  return createClient(url, key);
}

