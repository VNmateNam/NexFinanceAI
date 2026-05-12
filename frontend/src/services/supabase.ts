import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) console.error('VITE_SUPABASE_URL not set');
if (!supabaseAnonKey) console.error('VITE_SUPABASE_ANON_KEY not set');

declare global { interface Window { _sb?: SupabaseClient; } }

if (!window._sb) {
  window._sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'nexusai-sb-session',
    },
  });
}

export const supabase = window._sb!;
