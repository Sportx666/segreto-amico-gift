import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { config } from '@/config/env';

const SUPABASE_URL = config.supabase.url;
const SUPABASE_PUBLISHABLE_KEY = config.supabase.anonKey;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
