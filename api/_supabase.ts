import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config/env';

export function createServiceClient(): SupabaseClient {
  const url = config.supabase.serverUrl || config.supabase.url;
  const key = config.supabase.serviceRoleKey;

  if (!url) {
    throw new Error('SUPABASE_URL not defined');
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not defined - should be configured in Supabase secrets for production');
  }

  return createClient(url, key);
}